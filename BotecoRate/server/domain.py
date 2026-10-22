"""Protocolo 1. Funções puras: nenhuma escrita fora da transação RTDB."""
import copy
import hashlib
import json
import math
import re

TABLES = ("bares", "itens_cardapio", "avaliacoes_bares", "avaliacoes_itens")
FIELDS = {
    "bares": ("nome", "endereco", "detalhes", "foto", "latitude", "longitude"),
    "itens_cardapio": ("bar_id", "tipo", "nome", "descricao", "valor_centavos", "foto"),
    "avaliacoes_bares": ("bar_id", "nota", "comentario"),
    "avaliacoes_itens": ("item_id", "nota", "comentario"),
}


class DomainError(Exception):
    def __init__(self, code, message, status=422, **details):
        super().__init__(message)
        self.body = {"code": code, "message": message, **details}
        self.status = status


def require(condition, message, code="invalid", status=422, **details):
    if not condition:
        raise DomainError(code, message, status, **details)


def key(value):
    require(isinstance(value, str) and re.fullmatch(r"[A-Za-z0-9_-]{1,128}", value), "Identificador inválido.")
    return value


def authorize(root, uid):
    access = as_map(root.get("access_control")).get(uid, {})
    require(access.get("status", "ativo") == "ativo", "Conta suspensa ou excluída.", "forbidden", 403)
    return access.get("role", "comum")


def as_map(value):
    # RTDB converte mapas com chaves numéricas densas em arrays no REST.
    return {str(index): row for index, row in enumerate(value) if row is not None} if isinstance(value, list) else value or {}


def normalize_root(current):
    root = copy.deepcopy(current or {})
    state = root.setdefault("sync", {})
    state["entities"] = {table: as_map(rows) for table, rows in as_map(state.get("entities")).items()}
    state["events"] = as_map(state.get("events"))
    state["receipts"] = {uid: as_map(rows) for uid, rows in as_map(state.get("receipts")).items()}
    return root


def can_manage(root, uid, bar):
    return authorize(root, uid) == "admin" or uid in (bar.get("proprietarios") or [])


def active(entities, table, ident):
    row = entities.get(table, {}).get(ident)
    require(row and not row.get("deleted_at"), "Conteúdo excluído ou indisponível.", "deleted", 409)
    return row


def text(value, limit, required=False):
    require(isinstance(value, str) and len(value) <= limit and (not required or value.strip()), "Texto inválido ou muito longo.")


def fingerprint(command):
    return hashlib.sha256(json.dumps(command, sort_keys=True, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode()).hexdigest()


def apply_command(current, uid, name, command, now, public_url):
    """CAS de todo /v1: autoridade, pais, versões, auditoria e recibo atômicos.

    Pode ser chamado novamente pelo SDK. Não faz I/O nem depende de mutações
    externas; o relógio e a identidade já foram verificados pela rota.
    """
    root = normalize_root(current)
    role = authorize(root, uid)
    require(isinstance(command, dict) and command.get("protocol") == 1, "Protocolo inválido.")
    operation_id = key(command.get("operation_id"))
    changes = command.get("changes")
    require(isinstance(changes, list) and 0 < len(changes) <= 200, "Envie de 1 a 200 alterações por comando.")
    digest = fingerprint(command)
    state = root.setdefault("sync", {})
    receipts = state.setdefault("receipts", {}).setdefault(uid, {})
    previous = receipts.get(operation_id)
    if previous:
        require(previous["fingerprint"] == digest, "ID reutilizado com conteúdo diferente.", "operation_reused", 409)
        return root
    entities = state.setdefault("entities", {})
    original = copy.deepcopy(entities)
    touched = set()
    records = []
    # Pais primeiro, independentemente da ordem escolhida pelo aparelho.
    for change in changes:
        require(isinstance(change, dict) and change.get("entity_type") in TABLES, "Entidade inválida.")
    for change in sorted(changes, key=lambda c: TABLES.index(c["entity_type"])):
        table, ident = change["entity_type"], key(change.get("entity_id"))
        require((table, ident) not in touched, "Entidade repetida no mesmo comando.")
        touched.add((table, ident))
        old = original.get(table, {}).get(ident)
        version = old.get("version", 0) if old else 0
        base = change.get("base_version")
        require(type(base) is int and base >= 0, "Versão-base inválida.")
        require(base == version, "Outra alteração já foi confirmada. Revise as duas versões.", "conflict", 409,
                entity_type=table, entity_id=ident, remote=old)
        require(not old or not old.get("deleted_at"), "Uma edição não pode restaurar conteúdo excluído.", "deleted", 409, remote=old)
        operation = change.get("operation")
        require(operation in ("create", "update", "soft_delete"), "Operação inválida.")
        require((operation == "create") == (old is None), "Estado de criação incompatível.", "conflict", 409, remote=old)
        payload = change.get("payload")
        require(isinstance(payload, dict), "Conteúdo inválido.")
        row = {field: payload.get(field) for field in FIELDS[table]} if operation != "soft_delete" else copy.deepcopy(old)
        if old:
            parent = "bar_id" if table in ("itens_cardapio", "avaliacoes_bares") else "item_id"
            if table != "bares":
                require(row[parent] == old[parent], "Não é permitido trocar o alvo de um registro.")
        if table == "bares":
            if old:
                require(can_manage(root, uid, old), "Sem permissão para administrar este bar.", "forbidden", 403)
            else:
                require(role in ("dono", "admin"), "Somente donos habilitados e admins cadastram bares.", "forbidden", 403)
            row["proprietarios"] = old.get("proprietarios", []) if old else [uid]
            row["criado_por"] = old.get("criado_por") if old else uid
        else:
            parent = active(entities, "itens_cardapio", row["item_id"]) if table == "avaliacoes_itens" and operation != "soft_delete" else None
            # Exclusão dos filhos no mesmo comando de exclusão do bar é válida.
            source = original if operation == "soft_delete" else entities
            if table == "avaliacoes_itens":
                parent = parent or active(source, "itens_cardapio", row["item_id"])
            bar = active(source, "bares", parent["bar_id"] if parent else row["bar_id"])
            if table == "itens_cardapio":
                require(can_manage(root, uid, bar), "Sem permissão para alterar este cardápio.", "forbidden", 403)
            else:
                cascade = operation == "soft_delete" and can_manage(root, uid, bar) and (
                    entities.get("bares", {}).get(bar["id"], {}).get("deleted_at") or
                    (table == "avaliacoes_itens" and entities.get("itens_cardapio", {}).get(parent["id"], {}).get("deleted_at")))
                require(not old or old.get("autor_id") == uid or cascade, "Você só pode alterar sua própria avaliação.", "forbidden", 403)
                require(operation == "soft_delete" or uid not in bar.get("proprietarios", []), "Donos não podem avaliar seu estabelecimento.", "forbidden", 403)
                row.update(autor_id=old.get("autor_id") if old else uid, autor_nome=old.get("autor_nome", name) if old else name,
                           elegivel_ranking=old.get("elegivel_ranking", 1) if old else 1)
                parent_key = "bar_id" if table == "avaliacoes_bares" else "item_id"
                require(not any(r["id"] != ident and not r.get("deleted_at") and r.get("autor_id") == uid and r[parent_key] == row[parent_key]
                                for r in entities.get(table, {}).values()), "Você já avaliou este conteúdo.", "duplicate_review", 409)
        if operation != "soft_delete":
            if table in ("bares", "itens_cardapio"):
                text(row["nome"], 150, True)
                text(row["detalhes"] if table == "bares" else row["descricao"], 5000, True)
                photo = row.get("foto")
                require(photo is None or isinstance(photo, str), "Foto inválida.")
                if photo and photo != (old or {}).get("foto"):
                    prefix = public_url + "/v1/media/"
                    media_id = photo[len(prefix):] if photo.startswith(prefix) else ""
                    media = root.get("media", {}).get(media_id, {})
                    require(media.get("uid") == uid, "Faça upload da foto antes de publicar.")
                    require(media.get("bar_id") in (None, ident if table == "bares" else row["bar_id"]), "Foto pertence a outro bar.")
            if table == "bares":
                text(row["endereco"], 500, True)
                require(row["foto"], "O bar precisa de uma foto.")
                lat, lng = row.get("latitude"), row.get("longitude")
                require((lat is None and lng is None) or (type(lat) in (int, float) and type(lng) in (int, float) and math.isfinite(lat) and math.isfinite(lng) and -90 <= lat <= 90 and -180 <= lng <= 180), "Coordenadas inválidas.")
            elif table == "itens_cardapio":
                require(row["tipo"] in ("comida", "bebida") and type(row["valor_centavos"]) is int and 0 < row["valor_centavos"] <= 100000000, "Tipo ou preço inválido.")
            else:
                require(type(row["nota"]) is int and 1 <= row["nota"] <= 5, "Nota deve ser inteira de 1 a 5.")
                text(row["comentario"], 5000)
        row.update(id=ident, version=version + 1, created_at=old["created_at"] if old else now,
                   updated_at=now, deleted_at=now if operation == "soft_delete" else None)
        entities.setdefault(table, {})[ident] = row
        records.append({"entity_type": table, "entity_id": ident, "record": row, "before": old, "operation": operation})
    # Integridade do estado final; publicação e seus três itens nunca são parciais.
    for bar in entities.get("bares", {}).values():
        if not bar.get("deleted_at"):
            require(sum(1 for i in entities.get("itens_cardapio", {}).values() if i["bar_id"] == bar["id"] and not i.get("deleted_at")) >= 3,
                    "O bar precisa manter pelo menos três itens ativos.")
    for table in TABLES[1:]:
        for row in entities.get(table, {}).values():
            if row.get("deleted_at"):
                continue
            active(entities, "itens_cardapio" if table == "avaliacoes_itens" else "bares", row["item_id"] if table == "avaliacoes_itens" else row["bar_id"])
    sequence = state.get("sequence", 0) + 1
    state["sequence"] = sequence
    event = {"sequence": sequence, "operation_id": operation_id, "actor_uid": uid, "created_at": now, "changes": records}
    state.setdefault("events", {})[f"event_{sequence:020d}"] = event
    receipts[operation_id] = {"operation_id": operation_id, "fingerprint": digest, "sequence": sequence, "changes": records}
    root["catalog"] = {"version": sequence, "bares": [{k: b.get(k) for k in ("id", "nome", "endereco", "foto", "latitude", "longitude")}
                                                       for b in entities.get("bares", {}).values() if not b.get("deleted_at")]}
    return root
