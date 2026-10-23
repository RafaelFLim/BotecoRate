"""Preparação administrativa aditiva. Não participa do fluxo do aplicativo."""
from copy import deepcopy
import re


def as_map(value):
    if isinstance(value, list):
        return {str(index): row for index, row in enumerate(value) if row is not None}
    return value if isinstance(value, dict) else {}


def prepare_ownership(current, cards, actor_uid, occurred_at):
    root = deepcopy(current or {})
    direct = root.setdefault("direct", {})
    states = as_map(direct.get("ownership_state"))
    direct["ownership_state"] = states
    for bar_id, owners in as_map(direct.get("owners")).items():
        members = sorted(uid for uid, active in as_map(owners).items() if active is True)
        if not members or any(not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", uid) for uid in members):
            raise ValueError("Propriedade inválida: confira os UIDs antes de migrar.")
        if bar_id in states:
            registered = states[bar_id].get("owner_order", "").strip("|").split("|")
            if len(registered) != len(set(registered)) or set(registered) != set(members):
                raise ValueError("Índice de propriedade divergente; migração interrompida.")
        else:
            states[bar_id] = {"version": 0, "owner_order": "|" + "|".join(members) + "|",
                              "updated_at": occurred_at, "updated_by": actor_uid}
    direct.setdefault("ownership_epoch", 0)
    for uid, card in cards.items():
        access = root.get("access_control", {}).get(uid)
        profile = root.get("public_profiles", {}).get(uid, {})
        root.setdefault("ownership_accounts", {})[uid] = {
            "uid": uid, "name": (profile.get("name") or card["name"])[:100],
            "email_verified": bool(card["email_verified"]), "updated_at": occurred_at,
            "access": {"role": access.get("role", "comum") if access else "comum",
                       "status": access.get("status", "ativo") if access else "ativo",
                       "version": access.get("version", 0) if access else 0, "initialized": bool(access)},
        }
    root.setdefault("migrations", {}).setdefault("ownership_v1", {"applied_at": occurred_at, "actor_uid": actor_uid})
    return root


def promote_admin(current, uid, actor_uid, occurred_at, operation_id):
    root = deepcopy(current or {})
    old = root.get("access_control", {}).get(uid)
    if old and old.get("status") != "ativo":
        raise ValueError("Restaure a conta pelo painel antes de promover.")
    if old and old.get("role") == "admin":
        return root
    row = {"role": "admin", "status": "ativo", "version": (old or {}).get("version", 0) + 1,
           "updated_at": occurred_at, "updated_by": actor_uid, "last_operation": operation_id,
           "reason": "Concessão administrativa pela ferramenta local."}
    root.setdefault("access_control", {})[uid] = row
    root.setdefault("access_history", {}).setdefault(uid, {})[str(row["version"])] = {
        "actor_uid": actor_uid, "before": old or {"absent": True}, "record": row}
    root.setdefault("ownership_accounts", {}).setdefault(uid, {})["access"] = {
        "role": "admin", "status": "ativo", "version": row["version"], "initialized": True}
    direct = root.setdefault("direct", {})
    direct["ownership_epoch"] = direct.get("ownership_epoch", 0) + 1
    root.setdefault("admin_events", {})[operation_id] = {"action": "grant_admin", "target_uid": uid,
                                                        "actor_uid": actor_uid, "created_at": occurred_at}
    return root
