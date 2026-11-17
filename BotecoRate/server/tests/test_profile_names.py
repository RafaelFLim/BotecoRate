import unittest
from server.profile_names import prepare_profile_names, sync_user_directory, username_key, valid_name


class ProfileNamesTests(unittest.TestCase):
    def test_directory_import_preserves_canonical_name_over_auth_mirror(self):
        root = {'user_directory': {'a': {'name': 'João Silva'}}, 'username_index': {'joaosilva': 'a'}}
        cards = {'a': {'name': 'Espelho antigo', 'email': 'test@example.test', 'email_verified': True}}
        updated = sync_user_directory(root, cards, 'admin', 'now')
        self.assertEqual(updated['user_directory']['a']['name'], 'João Silva')
        self.assertEqual(updated['username_index'], {'joaosilva': 'a'})

    def test_normalization_and_invalid_names(self):
        self.assertEqual(username_key('João Silva'), username_key('joao.silva'))
        self.assertEqual(username_key('Jose\u0301'), username_key('José'))
        for value in ['A', 'ab12', '123', '...', 'Ana😀']:
            self.assertFalse(valid_name(value))
        self.assertTrue(valid_name('Ana123'))

    def test_preparation_is_additive_and_idempotent(self):
        current = {'access_control': {'a': {'role': 'admin'}}, 'direct': {'owners': {'bar': {'a': True}}},
                   'user_directory': {'a': {'name': 'João Silva'}}, 'public_profiles': {}}
        cards = {'b': {'name': 'Emanuel', 'email': 'test@example.test', 'email_verified': True}}
        prepared = prepare_profile_names(current, cards, 'a', 'now')
        self.assertEqual(prepared['username_index'], {'joaosilva': 'a', 'emanuel': 'b'})
        self.assertEqual(prepared['direct'], current['direct'])
        self.assertEqual(prepared['access_control'], current['access_control'])
        self.assertNotIn('username_index', current)
        self.assertEqual(prepare_profile_names(prepared, cards, 'a', 'later'), prepared)

    def test_collision_aborts_and_invalid_legacy_name_is_preserved(self):
        with self.assertRaises(ValueError):
            prepare_profile_names({'user_directory': {'a': {'name': 'João Silva'}, 'b': {'name': 'joao.silva'}}}, {}, 'admin', 'now')
        prepared = prepare_profile_names({'user_directory': {'a': {'name': 'A'}}}, {}, 'admin', 'now')
        self.assertEqual(prepared['user_directory']['a']['name'], 'A')
        self.assertEqual(prepared['username_index'], {})
