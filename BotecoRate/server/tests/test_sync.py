import copy
import io
import os
import unittest
from concurrent.futures import ThreadPoolExecutor
from threading import Lock

from server.domain import DomainError, apply_command

NOW = '2026-10-22T18:00:00Z'
URL = 'https://api.example.test'


def change(table, ident, payload, operation='create', base=0):
    return dict(entity_type=table, entity_id=ident, payload=payload, operation=operation, base_version=base)


def command(ident, changes):
    return dict(protocol=1, operation_id=ident, changes=changes)


def seed():
    return {'access_control': {'owner': {'role': 'dono', 'status': 'ativo'}, 'admin': {'role': 'admin', 'status': 'ativo'}},
            'media': {'photo': {'uid': 'owner'}}}


def publication():
    return command('publish', [change('bares', 'bar', dict(nome='Bar', endereco='Rua A', detalhes='Teste', foto=URL+'/v1/media/photo', latitude=None, longitude=None)),
                               *[change('itens_cardapio', 'item'+str(n), dict(bar_id='bar', tipo='comida', nome='Porção', descricao='Teste', valor_centavos=1200, foto=None)) for n in range(3)]])


class MemoryRoot:
    """Double transacional; os testes não têm credenciais ou acesso a produção."""
    def __init__(self, value):
        self.value = value
        self.lock = Lock()

    def get(self):
        with self.lock:
            return copy.deepcopy(self.value)

    def transaction(self, fn):
        with self.lock:
            self.value = fn(copy.deepcopy(self.value))
            return copy.deepcopy(self.value)


class DomainTests(unittest.TestCase):
    def setUp(self):
        self.root = apply_command(seed(), 'owner', 'Dono', publication(), NOW, URL)

    def test_publication_is_atomic_and_requires_three_items(self):
        original = seed()
        bad = publication()
        bad['changes'].pop()
        with self.assertRaises(DomainError):
            apply_command(original, 'owner', 'Dono', bad, NOW, URL)
        self.assertEqual(original, seed())
        self.assertEqual(self.root['sync']['sequence'], 1)
        self.assertEqual(len(self.root['sync']['entities']['itens_cardapio']), 3)

    def test_replay_after_lost_response_does_not_duplicate(self):
        replay = apply_command(self.root, 'owner', 'Outro nome', publication(), 'later', URL)
        self.assertEqual(replay, self.root)
        reused = publication()
        reused['changes'][0]['payload']['nome'] = 'Outro'
        with self.assertRaises(DomainError) as error:
            apply_command(self.root, 'owner', 'Dono', reused, NOW, URL)
        self.assertEqual(error.exception.body['code'], 'operation_reused')

    def test_ban_and_remote_permissions_override_client(self):
        for uid in ('customer', 'banned'):
            state = copy.deepcopy(self.root)
            state.setdefault('access_control', {})['banned'] = {'role':'admin','status':'banido'}
            patch = command('edit', [change('bares', 'bar', self.root['sync']['entities']['bares']['bar'], 'update', 1)])
            with self.assertRaises(DomainError) as error:
                apply_command(state, uid, 'Pessoa', patch, NOW, URL)
            self.assertEqual(error.exception.status, 403)

    def test_review_identity_unique_target_and_self_review(self):
        review = command('review', [change('avaliacoes_bares', 'review', dict(bar_id='bar', nota=5, comentario='Bom', autor_id='forged', elegivel_ranking=0))])
        with self.assertRaises(DomainError):
            apply_command(self.root, 'owner', 'Dono', review, NOW, URL)
        result = apply_command(self.root, 'customer', 'Cliente', review, NOW, URL)
        row = result['sync']['entities']['avaliacoes_bares']['review']
        self.assertEqual((row['autor_id'], row['elegivel_ranking']), ('customer', 1))
        duplicate = copy.deepcopy(review)
        duplicate['operation_id'] = 'second'
        duplicate['changes'][0]['entity_id'] = 'second'
        with self.assertRaises(DomainError) as error:
            apply_command(result, 'customer', 'Cliente', duplicate, NOW, URL)
        self.assertEqual(error.exception.body['code'], 'duplicate_review')

    def test_concurrent_edit_has_one_winner_and_preserves_conflict(self):
        root = MemoryRoot(self.root)
        def edit(index):
            payload = {**self.root['sync']['entities']['bares']['bar'], 'nome':'Bar '+str(index)}
            try:
                root.transaction(lambda current: apply_command(current, 'owner', 'Dono', command('edit'+str(index), [change('bares','bar',payload,'update',1)]), NOW, URL))
                return 'accepted'
            except DomainError as error:
                return error.body['code']
        with ThreadPoolExecutor(2) as pool:
            self.assertCountEqual(list(pool.map(edit, [1,2])), ['accepted','conflict'])
        self.assertEqual(root.get()['sync']['sequence'], 2)

    def test_deleted_entity_cannot_be_resurrected(self):
        rows = self.root['sync']['entities']
        delete = command('delete', [change(table, ident, row, 'soft_delete', row['version']) for table, values in rows.items() for ident,row in values.items()])
        result = apply_command(self.root, 'owner', 'Dono', delete, NOW, URL)
        self.assertFalse(result['catalog']['bares'])
        with self.assertRaises(DomainError) as error:
            apply_command(result, 'owner', 'Dono', command('restore',[change('bares','bar',rows['bares']['bar'],'update',2)]), NOW, URL)
        self.assertEqual(error.exception.body['code'], 'deleted')

    def test_owner_deletes_bar_with_reviews_without_rewriting_authorship(self):
        review = command('review',[change('avaliacoes_bares','review',dict(bar_id='bar',nota=4,comentario='Cliente'))])
        state = apply_command(self.root,'customer','Cliente',review,NOW,URL)
        rows = state['sync']['entities']
        delete = command('cascade',[change(table,ident,row,'soft_delete',row['version']) for table,values in rows.items() for ident,row in values.items()])
        result = apply_command(state,'owner','Dono',delete,NOW,URL)
        row = result['sync']['entities']['avaliacoes_bares']['review']
        self.assertEqual(row['autor_id'],'customer')
        self.assertEqual(row['comentario'],'Cliente')
        self.assertTrue(row['deleted_at'])


class ApiTests(unittest.TestCase):
    def setUp(self):
        from server.app import create_app
        os.environ['PUBLIC_API_URL'] = URL
        self.root = MemoryRoot(apply_command(seed(), 'owner', 'Dono', publication(), NOW, URL))
        def verify(token):
            if token == 'bad':
                raise ValueError('invalid')
            return {'uid': token, 'email_verified': token != 'unverified', 'name':'Pessoa'}
        self.client = create_app(root=self.root, verify_token=verify).test_client()

    def test_authentication_and_cursor(self):
        self.assertEqual(self.client.get('/v1/sync/snapshot').status_code, 401)
        for token, status in [('bad',401),('unverified',403),('customer',200)]:
            self.assertEqual(self.client.get('/v1/sync/snapshot', headers={'Authorization':'Bearer '+token}).status_code, status)
        headers = {'Authorization':'Bearer customer'}
        page = self.client.get('/v1/sync/events?after=0', headers=headers).json
        self.assertEqual(page['sequence'], 1)
        self.assertFalse(page['has_more'])
        self.assertEqual(self.client.get('/v1/sync/events?after=2',headers=headers).json['code'], 'cursor_expired')
        self.assertEqual(self.client.get('/v1/sync/events?after=x',headers=headers).status_code,422)

    def test_command_revalidates_ban(self):
        headers = {'Authorization':'Bearer owner'}
        first = self.client.post('/v1/sync/commands', json=publication(), headers=headers)
        self.assertEqual(first.status_code, 200)
        self.root.value['access_control']['owner']['status'] = 'banido'
        self.assertEqual(self.client.post('/v1/sync/commands', json=publication(), headers=headers).status_code,403)

    def test_media_is_private_until_published_and_sanitized(self):
        from PIL import Image
        from server.app import create_app
        class Blob:
            def upload_from_string(self, data, **kwargs):
                self.data = data
            def download_as_bytes(self):
                return self.data
        class Bucket:
            def __init__(self):
                self.blobs = {}
            def blob(self, path):
                return self.blobs.setdefault(path, Blob())
        client = create_app(self.root, lambda token: {'uid':token,'email_verified':True}, Bucket()).test_client()
        data = io.BytesIO()
        Image.new('RGB',(10,10),'red').save(data,'PNG')
        upload = client.post('/v1/media',data={'file':(io.BytesIO(data.getvalue()),'fake.html'),'bar_id':'bar'},headers={'Authorization':'Bearer owner'})
        self.assertEqual(upload.status_code,200)
        path = upload.json['url'][len(URL):]
        self.assertEqual(client.get(path).status_code,404)
        photo = {**self.root.value['sync']['entities']['bares']['bar'],'foto':upload.json['url']}
        response = client.post('/v1/sync/commands',json=command('photo',[change('bares','bar',photo,'update',1)]),headers={'Authorization':'Bearer owner'})
        self.assertEqual(response.status_code,200)
        self.assertEqual(client.get(path).content_type,'image/jpeg')
        invalid = client.post('/v1/media',data={'file':(io.BytesIO(b'<html>'),'x.jpg')},headers={'Authorization':'Bearer owner'})
        self.assertEqual(invalid.status_code,422)
        forbidden = client.post('/v1/media',data={'file':(io.BytesIO(data.getvalue()),'x.png'),'bar_id':'bar'},headers={'Authorization':'Bearer customer'})
        self.assertEqual(forbidden.status_code,403)


if __name__ == '__main__':
    unittest.main()
