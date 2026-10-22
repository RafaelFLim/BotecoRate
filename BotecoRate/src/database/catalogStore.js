// SQL sem dependência de Expo: também usado nos testes reais de SQLite.
const TABLES = ['bares', 'itens_cardapio', 'avaliacoes_bares', 'avaliacoes_itens'];
const iso = () => new Date().toISOString();

export async function readCatalog(db) {
  const rows = {};
  for (const table of TABLES) rows[table] = await db.getAllAsync(`SELECT * FROM ${table} WHERE deleted_at IS NULL ORDER BY created_at DESC`);
  const histories = {};
  for (const table of TABLES) {
    histories[table] = await db.getAllAsync(`SELECT * FROM ${table}_historico WHERE acao IN ('update','legacy') ORDER BY created_at,id`);
  }
  function history(table, id) {
    return histories[table].filter((h) => h.entidade_id === id).map((h) => JSON.parse(h.snapshot_json));
  }
  const review = (table, row) => ({
    id: row.id, nota: row.nota, comentario: row.comentario, autor: row.autor_nome, autorId: row.autor_id,
    criadoEm: row.created_at, editadoEm: row.updated_at !== row.created_at ? row.updated_at : null,
    elegivelRanking: Boolean(row.elegivel_ranking), historico: history(table, row.id),
  });
  const owners = await db.getAllAsync('SELECT * FROM bar_proprietarios WHERE deleted_at IS NULL');
  return rows.bares.map((bar) => ({
    id: bar.id, nome: bar.nome, endereco: bar.endereco, detalhes: bar.detalhes, foto: bar.foto,
    latitude: bar.latitude, longitude: bar.longitude, criadoPor: bar.criado_por,
    proprietarios: owners.filter((o) => o.bar_id === bar.id).map((o) => o.usuario_id),
    criadoEm: bar.created_at, editadoEm: bar.updated_at, version: bar.version,
    avaliacoes: rows.avaliacoes_bares.filter((r) => r.bar_id === bar.id).map((r) => review('avaliacoes_bares', r)),
    cardapio: rows.itens_cardapio.filter((i) => i.bar_id === bar.id).map((item) => ({
      id: item.id, tipo: item.tipo, nome: item.nome, descricao: item.descricao,
      valor: item.valor_centavos / 100, foto: item.foto, criadoEm: item.created_at,
      editadoEm: item.updated_at !== item.created_at ? item.updated_at : null,
      historico: history('itens_cardapio', item.id),
      avaliacoes: rows.avaliacoes_itens.filter((r) => r.item_id === item.id).map((r) => review('avaliacoes_itens', r)),
    })),
  }));
}

export async function storeCatalog(tx, bars, { actorId = null, enqueue = false, newId, legacy = false } = {}) {
  const now = iso();
  const desired = Object.fromEntries(TABLES.map((name) => [name, []]));
  const legacyHistories = [];
  const sourceDates = new Map();
  function addReview(table, parentKey, parentId, r) {
    sourceDates.set(`${table}:${r.id}`, { created: r.criadoEm, updated: r.editadoEm });
    desired[table].push({ id: r.id, [parentKey]: parentId, nota: r.nota, comentario: r.comentario,
      autor_id: r.autorId || null, autor_nome: r.autor || 'anônimo',
      elegivel_ranking: r.elegivelRanking === false ? 0 : 1 });
    if (legacy) for (const snapshot of r.historico || []) legacyHistories.push({ table, id: r.id, snapshot });
  }
  for (const bar of bars) {
    sourceDates.set(`bares:${bar.id}`, { created: bar.criadoEm, updated: bar.editadoEm });
    desired.bares.push({ id: bar.id, nome: bar.nome, endereco: bar.endereco, detalhes: bar.detalhes || '',
      foto: bar.foto || null, latitude: bar.latitude ?? null, longitude: bar.longitude ?? null, criado_por: bar.criadoPor || null });
    for (const r of bar.avaliacoes || []) addReview('avaliacoes_bares', 'bar_id', bar.id, r);
    for (const item of bar.cardapio || []) {
      sourceDates.set(`itens_cardapio:${item.id}`, { created: item.criadoEm, updated: item.editadoEm });
      desired.itens_cardapio.push({ id: item.id, bar_id: bar.id, tipo: item.tipo, nome: item.nome,
        descricao: item.descricao || '', valor_centavos: Math.round(item.valor * 100), foto: item.foto || null });
      for (const r of item.avaliacoes || []) addReview('avaliacoes_itens', 'item_id', item.id, r);
      if (legacy) for (const snapshot of item.historico || []) legacyHistories.push({ table: 'itens_cardapio', id: item.id, snapshot });
    }
  }
  for (const table of TABLES) {
    const existing = await tx.getAllAsync(`SELECT * FROM ${table}`);
    const wantedIds = new Set(desired[table].map((row) => row.id));
    const changes = [...desired[table], ...existing.filter((row) => !row.deleted_at && !wantedIds.has(row.id)).map((row) => ({ id: row.id, deleted_at: now }))];
    for (const row of changes) {
      const old = existing.find((r) => r.id === row.id);
      if (old && !row.deleted_at && Object.keys(row).every((key) => old[key] === row[key]) && !old.deleted_at) continue;
      const action = row.deleted_at ? 'soft_delete' : old ? 'update' : 'create';
      const dates = sourceDates.get(`${table}:${row.id}`);
      const validDate = (value) => value && Number.isFinite(Date.parse(value)) ? value : null;
      const createdAt = old?.created_at || (legacy && validDate(dates?.created)) || now;
      const current = { ...row, created_at: createdAt, updated_at: legacy ? validDate(dates?.updated) || createdAt : now,
        deleted_at: row.deleted_at || null, version: (old?.version || 0) + 1 };
      if (row.deleted_at) {
        await tx.runAsync(`UPDATE ${table} SET deleted_at=?,updated_at=?,version=? WHERE id=?`, now, now, current.version, row.id);
      } else {
        const columns = Object.keys(current);
        await tx.runAsync(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')}) ON CONFLICT(id) DO UPDATE SET ${columns.filter((c) => c !== 'id').map((c) => `${c}=excluded.${c}`).join(',')}`, ...Object.values(current));
      }
      const operationId = newId();
      const snapshot = old ? {
        ...old, valor: old.valor_centavos === undefined ? undefined : old.valor_centavos / 100,
        data: old.updated_at,
      } : current;
      await tx.runAsync(`INSERT INTO ${table}_historico(id,entidade_id,actor_id,acao,snapshot_json,created_at) VALUES (?,?,?,?,?,?)`, operationId, row.id, actorId, action, JSON.stringify(snapshot), now);
      if (enqueue) await tx.runAsync('INSERT INTO sync_queue(operation_id,account_uid,entity_type,entity_id,operation,payload,base_version,created_at) VALUES (?,?,?,?,?,?,?,?)',
        operationId, actorId, table, row.id, action, JSON.stringify({ ...old, ...current }), old?.version || 0, now);
    }
  }
  for (const h of legacyHistories) await tx.runAsync(`INSERT INTO ${h.table}_historico(id,entidade_id,actor_id,acao,snapshot_json,created_at) VALUES (?,?,?,?,?,?)`,
    newId(), h.id, null, 'legacy', JSON.stringify(h.snapshot), now);
}
