"""Integração real Admin SDK + RTDB local. Nunca usa credenciais de produção."""
import copy
import json
import os
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from server.domain import DomainError, apply_command
from server.demo import import_demo
from server.tests.test_sync import seed, publication, command, change, NOW, URL


@unittest.skipUnless(os.environ.get('FIREBASE_DATABASE_EMULATOR_HOST'), 'Emulador RTDB não iniciado')
class EmulatorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import firebase_admin
        from firebase_admin import db
        # Projeto fictício e host local obrigatórios, mesmo se ADC existir.
        host = os.environ['FIREBASE_DATABASE_EMULATOR_HOST']
        if not host.startswith(('127.0.0.1:', 'localhost:')):
            raise RuntimeError('Estes testes só permitem emulador local.')
        cls.app = firebase_admin.initialize_app(options={'projectId':'demo-botecorate','databaseURL':'https://demo-botecorate-default-rtdb.firebaseio.com'}, name='sync-tests')
        cls.root = db.reference('sync_integration', app=cls.app)

    @classmethod
    def tearDownClass(cls):
        import firebase_admin
        cls.root.delete()
        firebase_admin.delete_app(cls.app)

    def setUp(self):
        self.root.set(apply_command(seed(),'owner','Dono',publication(),NOW,URL))

    def test_replay_and_real_optimistic_concurrency(self):
        # Round-trip remove nulls; recibo repetido continua estável.
        first = self.root.get()
        replay = self.root.transaction(lambda current: apply_command(current,'owner','Dono',publication(),NOW,URL))
        self.assertEqual(replay['sync']['sequence'],1)
        row = first['sync']['entities']['bares']['bar']
        def edit(index):
            patch = command('concurrent'+str(index),[change('bares','bar',{**row,'nome':'Bar '+str(index)},'update',1)])
            try:
                self.root.transaction(lambda current: apply_command(current,'owner','Dono',patch,NOW,URL))
                return 'accepted'
            except DomainError as error:
                return error.body['code']
        with ThreadPoolExecutor(2) as pool:
            self.assertCountEqual(list(pool.map(edit,[1,2])),['accepted','conflict'])
        self.assertEqual(self.root.get()['sync']['sequence'],2)

    def test_import_numeric_ids_roundtrip_and_deletion(self):
        fixture = json.loads((Path(__file__).parents[1]/'seeds/bares-demonstracao.json').read_text(encoding='utf-8'))
        state = seed()
        self.root.set(import_demo(state,fixture,'admin',NOW))
        self.root.transaction(lambda current: import_demo(current,fixture,'admin',NOW))
        from server.app import create_app
        client = create_app(root=self.root,verify_token=lambda token:{'uid':'admin','email_verified':True}).test_client()
        response = client.get('/v1/sync/snapshot',headers={'Authorization':'Bearer admin'})
        self.assertEqual(response.status_code,200)
        entities = response.json['entities']
        self.assertEqual(len(entities['bares']),4)
        row = entities['bares']['1']
        patch = command('edit-numeric',[change('bares','1',{**row,'nome':'Novo nome'},'update',1)])
        response = client.post('/v1/sync/commands',json=patch,headers={'Authorization':'Bearer admin'})
        self.assertEqual(response.status_code,200,response.json)
        self.assertEqual(response.json['sequence'],2)
        self.assertTrue(all(not r.get('autor_id') and r['elegivel_ranking']==0 for t in ('avaliacoes_bares','avaliacoes_itens') for r in entities[t].values()))

    def test_ranking_invalidation_event_roundtrip_and_departure(self):
        opinions = command('opinions', [
            change('avaliacoes_bares', 'review', dict(bar_id='bar', nota=5, comentario='Bar')),
            change('avaliacoes_itens', 'itemreview', dict(item_id='item0', nota=4, comentario='Item')),
        ])
        self.root.transaction(lambda current: apply_command(current, 'customer', 'Cliente', opinions, NOW, URL))

        def transition(current, joining):
            # Fixture da futura mudança autorizada de propriedade, não um endpoint.
            bar = current['sync']['entities']['bares']['bar']
            bar['proprietarios'] = ['owner', 'customer'] if joining else ['owner']
            edit = command('join' if joining else 'leave', [change('bares', 'bar', {**bar, 'nome': 'Novo'}, 'update', bar['version'])])
            return apply_command(current, 'admin', 'Admin', edit, NOW, URL)

        joined = self.root.transaction(lambda current: transition(current, True))
        self.assertEqual(len(joined['sync']['receipts']['admin']['join']['changes']), 3)
        left = self.root.transaction(lambda current: transition(current, False))
        self.assertEqual(len(left['sync']['receipts']['admin']['leave']['changes']), 1)
        for table, ident in [('avaliacoes_bares', 'review'), ('avaliacoes_itens', 'itemreview')]:
            row = left['sync']['entities'][table][ident]
            self.assertEqual((row['elegivel_ranking'], row['version']), (0, 2))
        from server.app import create_app
        client = create_app(root=self.root, verify_token=lambda token: {'uid': 'admin', 'email_verified': True}).test_client()
        response = client.get('/v1/sync/events?after=2', headers={'Authorization': 'Bearer admin'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual([len(event['changes']) for event in response.json['events']], [3, 1])
