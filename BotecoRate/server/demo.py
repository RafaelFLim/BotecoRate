"""Conversão da carga controlada para o mesmo catálogo usado pela API."""
import copy

from server.domain import TABLES, authorize, require, normalize_root


def import_demo(current, seed, uid, now):
    root = normalize_root(current)
    require(authorize(root, uid) == 'admin', 'Admin ativo obrigatório.', 'forbidden', 403)
    if root.get('migrations', {}).get('demo_sync_v1'):
        return root
    require(not any(root['sync']['entities'].values()), 'Destino já contém dados de sincronização.')
    require(not root.get('catalog') or root.get('migrations', {}).get('demo_v1'), 'Catálogo não identificado como carga de demonstração.')
    entities = {table:{} for table in TABLES}
    changes = []

    def add(table, row, date):
        row.update(version=1,created_at=date or now,updated_at=date or now,deleted_at=None)
        entities[table][row['id']] = row
        changes.append(dict(entity_type=table,entity_id=row['id'],record=row,operation='create'))

    def review(table, parent_key, parent_id, source):
        add(table, dict(id=source['id'],**{parent_key:parent_id},autor_id=None,autor_nome=source.get('autor') or 'Demonstração',
                        nota=source['nota'],comentario=source['comentario'],elegivel_ranking=0), source.get('criadoEm'))

    for bar in copy.deepcopy(seed):
        require(len(bar.get('cardapio',[])) >= 3, 'Seed precisa de três itens por bar.')
        add('bares',dict(id=bar['id'],nome=bar['nome'],endereco=bar['endereco'],detalhes=bar['detalhes'],foto=bar['foto'],
                         latitude=bar.get('latitude'),longitude=bar.get('longitude'),proprietarios=[uid],criado_por=uid),bar.get('criadoEm'))
        for r in bar.get('avaliacoes',[]):
            review('avaliacoes_bares','bar_id',bar['id'],r)
        for item in bar.get('cardapio',[]):
            add('itens_cardapio',dict(id=item['id'],bar_id=bar['id'],tipo=item['tipo'],nome=item['nome'],descricao=item['descricao'],
                                     valor_centavos=round(item['valor']*100),foto=item.get('foto')),item.get('criadoEm'))
            for r in item.get('avaliacoes',[]):
                review('avaliacoes_itens','item_id',item['id'],r)
    root['sync']['entities'] = entities
    sequence = root['sync'].get('sequence',0)+1
    root['sync']['sequence'] = sequence
    root['sync']['events'][f'event_{sequence:020d}'] = dict(sequence=sequence,operation_id='import_demo_sync_v1',actor_uid=uid,created_at=now,changes=changes)
    root['catalog'] = dict(version=sequence,bares=[{k:b.get(k) for k in ('id','nome','endereco','foto','latitude','longitude')} for b in entities['bares'].values()])
    root.setdefault('migrations',{})['demo_sync_v1'] = dict(created_at=now,actor_uid=uid)
    return root
