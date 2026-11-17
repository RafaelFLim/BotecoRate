import { TABLES } from './directProtocol.js';

const retention = 30 * 86400000;

export function planTrashRestore(state, { type, id, actor, admin, operationId, now }) {
  if (!TABLES.includes(type)) throw new Error('Tipo de registro inválido.');
  const entities = state.entities || {};
  const row = entities[type]?.[id];
  if (!row?.deleted_at) throw new Error('O registro já foi restaurado ou não está mais na lixeira.');
  const time = (table, target) => state.deletion_times?.[table]?.[target.id]?.[target.version];
  const event = (table, target) => state.history?.[table]?.[target.id]?.[target.version];
  const valid = (table, target) => Number.isFinite(time(table,target)) && now < time(table,target)+retention &&
    event(table,target)?.operation === 'soft_delete' && (admin || event(table,target).actor_uid === actor);
  if (!valid(type,row)) throw new Error('A exclusão não pertence à conta ou o prazo de restauração venceu.');
  const item = type==='avaliacoes_itens' ? entities.itens_cardapio?.[row.item_id] : null;
  const barId = type==='bares' ? id : item?.bar_id || row.bar_id;
  const bar = entities.bares?.[barId];
  const owner = state.owners?.[barId]?.[actor] === true;
  const isReview = type.startsWith('avaliacoes_');
  if (!admin && (isReview ? row.autor_id !== actor : !owner)) throw new Error('Você não tem mais permissão para restaurar este registro.');
  if (!bar || (type!=='bares' && bar.deleted_at) || (type==='avaliacoes_itens' && (!item || item.deleted_at))) {
    throw new Error('Restaure primeiro o bar ou item ao qual este registro pertence.');
  }
  const availableReview = (table, review) => {
    const target = table==='avaliacoes_bares' ? review.bar_id : review.item_id;
    const moderation = state.moderation?.[table]?.[review.id];
    return review.autor_id && state.review_index?.[table]?.[target]?.[review.autor_id] === review.id &&
      (!moderation || moderation.status==='visivel');
  };
  if (isReview && !availableReview(type,row)) throw new Error('Há outra avaliação registrada ou a avaliação está sujeita à moderação.');
  const changes = [];
  const add = (table, target) => changes.push({entity_type:table,entity_id:target.id,operation:'restore',base_version:target.version});
  const inGroup = (table, target) => target?.deleted_at && target.last_operation===row.last_operation && valid(table,target);
  add(type,row);
  const restoredItems = new Set(type==='itens_cardapio' ? [id] : []);
  if (type==='bares') {
    for (const entry of Object.values(entities.itens_cardapio || {})) {
      if (entry?.bar_id===id && inGroup('itens_cardapio',entry)) {
        add('itens_cardapio',entry);
        restoredItems.add(entry.id);
      }
    }
    for (const review of Object.values(entities.avaliacoes_bares || {})) {
      if (review?.bar_id===id && inGroup('avaliacoes_bares',review) && availableReview('avaliacoes_bares',review)) add('avaliacoes_bares',review);
    }
  }
  for (const review of Object.values(entities.avaliacoes_itens || {})) {
    if (!review) continue;
    const parent = entities.itens_cardapio?.[review.item_id];
    if ((restoredItems.has(review.item_id) || (type==='bares' && parent?.bar_id===id && !parent.deleted_at)) &&
        inGroup('avaliacoes_itens',review) && availableReview('avaliacoes_itens',review)) add('avaliacoes_itens',review);
  }
  return {protocol:1,operation_id:operationId,changes};
}
