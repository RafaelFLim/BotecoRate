import copy
import json
import unittest
from pathlib import Path
from server.demo import import_demo
from server.direct import prepare_direct


class DirectMigrationTests(unittest.TestCase):
    def test_migration_is_additive_and_idempotent(self):
        seed = json.loads((Path(__file__).parents[1] / 'seeds/bares-demonstracao.json').read_text(encoding='utf-8'))
        original = import_demo({'access_control': {'owner': {'role': 'admin', 'status': 'ativo'}}}, seed, 'owner', '2026-10-22')
        before = copy.deepcopy(original)
        result = prepare_direct(original, 'owner', '2026-10-22')
        self.assertEqual(original, before)
        self.assertEqual(result['sync'], before['sync'])
        self.assertEqual(result['access_control'], before['access_control'])
        self.assertEqual(len(result['direct']['entities']['bares']), 4)
        self.assertEqual(len(result['direct']['entities']['itens_cardapio']), 12)
        self.assertEqual(result['direct']['owners']['1'], {'owner': True})
        self.assertEqual(prepare_direct(result, 'owner', '2026-10-22'), result)
