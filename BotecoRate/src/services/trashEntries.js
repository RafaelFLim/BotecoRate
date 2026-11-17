const types = {
  bares: 'Bar',
  itens_cardapio: 'Item de cardápio',
  avaliacoes_bares: 'Avaliação de bar',
  avaliacoes_itens: 'Avaliação de item',
  usuarios: 'Usuário',
};
const retention = 30 * 86400000;

export function listTrashEntries({ direct, actor, admin, accounts = {}, directory = {} }) {
  const entries = [];
  function add(type, id, title, deletion, deletedBy, restoreAction = null, deletedAtMs) {
    if (!deletion.deleted_at || (!admin && deletedBy !== actor)) return;
    entries.push({
      key: `${type}:${id}`, type, typeLabel: types[type], id, title,
      deletedAt: deletion.deleted_at, deletedBy, deletedByName: directory[deletedBy]?.name || deletedBy,
      deadline: deletion.purge_after || (deletedAtMs ?? Date.parse(deletion.deleted_at)) + retention,
      restoreAction,
    });
  }
  const bars = direct.entities?.bares || {};
  const items = direct.entities?.itens_cardapio || {};
  for (const type of Object.keys(types).filter(type => type !== 'usuarios')) {
    for (const [id, row] of Object.entries(direct.entities?.[type] || {})) {
      if (!row) continue;
      const moderation = direct.moderation?.[type]?.[id];
      const target = type === 'avaliacoes_bares' ? bars[row.bar_id]?.nome : items[row.item_id]?.nome;
      const title = row.nome || [row.autor_nome, target].filter(Boolean).join(' · ') || id;
      if (moderation?.status === 'excluida') {
        if (admin) add(type, id, title, moderation, moderation.updated_by, row.deleted_at ? null : 'visivel');
        continue;
      }
      if (!row.deleted_at) continue;
      const event = direct.history?.[type]?.[id]?.[row.version];
      const deletedBy = event?.operation === 'soft_delete' && event.record?.deleted_at === row.deleted_at ? event.actor_uid : null;
      const timestamp = direct.deletion_times?.[type]?.[id]?.[row.version];
      add(type, id, title, row, deletedBy, deletedBy && Number.isFinite(timestamp) ? 'catalogo' : null, timestamp);
    }
  }
  if (admin) {
    for (const [uid, access] of Object.entries(accounts)) {
      if (access.status === 'excluido') add('usuarios', uid, directory[uid]?.name || uid, access, access.updated_by, 'restaurar');
    }
  }
  return entries.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt) || a.key.localeCompare(b.key));
}
