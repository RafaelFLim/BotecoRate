import unittest
from server.ownership import prepare_ownership, promote_admin


class OwnershipPreparationTests(unittest.TestCase):
    def test_additive_idempotent_and_does_not_transfer_real_owners(self):
        original = {"direct": {"owners": {"bar": {"b": True, "a": True}}, "entities": {"bares": {"bar": {"nome": "Bar"}}}},
                    "access_control": {"a": {"role": "dono", "status": "ativo"}}}
        cards = {"a": {"name": "Dono", "email_verified": True}}
        result = prepare_ownership(original, cards, "admin", "2026-10-22")
        self.assertNotIn("ownership_state", original["direct"])
        self.assertEqual(result, prepare_ownership(result, cards, "admin", "2026-10-22"))
        self.assertEqual(result["direct"]["owners"], original["direct"]["owners"])
        self.assertEqual(result["direct"]["ownership_state"]["bar"]["owner_order"], "|a|b|")
        self.assertNotIn("email", result["ownership_accounts"]["a"])

    def test_divergent_index_does_not_overwrite_existing_consents(self):
        original = {"direct": {"owners": {"bar": {"a": True}}, "ownership_state": {"bar": {"version": 3, "owner_order": "|b|"}}}}
        with self.assertRaises(ValueError):
            prepare_ownership(original, {}, "admin", "now")
        self.assertEqual(original["direct"]["ownership_state"]["bar"]["version"], 3)

    def test_local_promotion_preserves_audit_and_invalidates_pending_consents(self):
        result = promote_admin({}, "a", "bootstrap", "now", "op")
        self.assertEqual(result["access_history"]["a"]["1"]["record"]["role"], "admin")
        self.assertEqual(result["direct"]["ownership_epoch"], 1)
        self.assertEqual(result, promote_admin(result, "a", "bootstrap", "later", "op2"))
