// Projeção canônica recebida do Firebase, sem editar o conteúdo das avaliações.
export async function saveModeration(tx, moderation={}, history={}) {
  await tx.runAsync('DELETE FROM review_moderation');
  for (const table of ['avaliacoes_bares','avaliacoes_itens']) {
    for (const [id,row] of Object.entries(moderation[table]||{})) {
      if (!row) continue;
      await tx.runAsync('INSERT INTO review_moderation(entity_type,entity_id,status,reason,actor_id,version,updated_at,deleted_at,purge_after) VALUES (?,?,?,?,?,?,?,?,?)',
        table,id,row.status,row.reason,row.updated_by,row.version,row.updated_at,row.deleted_at||null,row.purge_after||null);
    }
    for (const [id,versions] of Object.entries(history[table]||{})) for (const [version,event] of Object.entries(versions||{})) {
      if (!event) continue;
      await tx.runAsync('INSERT OR IGNORE INTO review_moderation_historico(id,entity_type,entity_id,actor_id,snapshot_json,created_at) VALUES (?,?,?,?,?,?)',
        `${table}:${id}:${version}`,table,id,event.actor_uid,JSON.stringify(event),event.record.updated_at);
    }
  }
}
