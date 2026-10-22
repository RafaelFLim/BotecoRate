"""One-time additive migration; runtime synchronization does not use this module."""
import copy
from server.domain import TABLES, authorize, require, normalize_root


def prepare_direct(current, uid, now):
    root = normalize_root(current)
    require(authorize(root, uid) == 'admin', 'Admin ativo obrigatório.', 'forbidden', 403)
    if root.get('migrations', {}).get('direct_v1'):
        return root
    require(not root.get('direct'), 'Destino direto já existe sem marcador de migração.')
    entities = copy.deepcopy(root['sync']['entities'])
    for table in TABLES:
        entities.setdefault(table, {})
    owners, public = {}, {}
    for bar in entities['bares'].values():
        owners[bar['id']] = {owner: True for owner in bar.pop('proprietarios', [])}
        require(bar.get('criado_por') in owners[bar['id']], 'Bar sem responsável comprovado; revisar antes de migrar.')
        if not bar.get('deleted_at'):
            items = sorted(i['id'] for i in entities['itens_cardapio'].values()
                           if i['bar_id'] == bar['id'] and not i.get('deleted_at'))
            require(len(items) >= 3, 'Bar publicado com menos de três itens.')
            bar.update(item_a=items[0], item_b=items[1], item_c=items[2])
        public[bar['id']] = {k: bar.get(k) for k in ('id', 'nome', 'endereco', 'foto', 'latitude', 'longitude', 'version', 'deleted_at')}
    history = {table: {} for table in TABLES}
    index = {}
    for table, rows in entities.items():
        for row in rows.values():
            row['last_operation'] = 'bootstrap_direct'
            # The original event journal remains untouched at v1/sync/events.
            history[table][row['id']] = {str(row['version']): {
                'actor_uid': uid, 'operation_id': 'bootstrap_direct', 'operation': 'create',
                'before': {'absent': True}, 'record': copy.deepcopy(row),
            }}
            if table.startswith('avaliacoes_') and row.get('autor_id') and not row.get('deleted_at'):
                parent = row['bar_id' if table == 'avaliacoes_bares' else 'item_id']
                target = index.setdefault(table, {}).setdefault(parent, {})
                require(row['autor_id'] not in target, 'Avaliações duplicadas; revisar antes de migrar.')
                target[row['autor_id']] = row['id']
    root['direct'] = dict(entities=entities, owners=owners, public_bars=public, history=history, review_index=index)
    root.setdefault('migrations', {})['direct_v1'] = dict(actor_uid=uid, created_at=now, source='sync/entities')
    return root
