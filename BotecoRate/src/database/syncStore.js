import { TABLES } from './catalogStore.js';

const setting = async (tx, key, value) => tx.runAsync('INSERT INTO app_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', key, String(value));

// A projeção relacional é descartável. A réplica confirmada e as intenções de
// cada conta ficam separadas; mudar de conta nunca publica nem mostra a fila alheia.
export async function initializeSync(tx, newId) {
  if (await tx.getFirstAsync("SELECT value FROM app_settings WHERE key='sync_v2_initialized'")) return;
  const pending = await tx.getAllAsync('SELECT * FROM sync_queue ORDER BY rowid');
  for (const table of TABLES) {
    for (const source of await tx.getAllAsync(`SELECT * FROM ${table}`)) {
      let row = source;
      const first = pending.find(q => q.entity_type === table && q.entity_id === row.id);
      if (first?.operation === 'create') continue;
      if (first) {
        const history = await tx.getFirstAsync(`SELECT snapshot_json FROM ${table}_historico WHERE id=?`, first.operation_id);
        if (!history) continue;
        row = JSON.parse(history.snapshot_json);
      }
      if (table === 'bares') row.proprietarios = (await tx.getAllAsync('SELECT usuario_id FROM bar_proprietarios WHERE bar_id=? AND deleted_at IS NULL', row.id)).map(o => o.usuario_id);
      await tx.runAsync('INSERT OR IGNORE INTO sync_entities(entity_type,entity_id,payload,version) VALUES (?,?,?,0)', table, row.id, JSON.stringify(row));
    }
  }
  // Preserva filas v1, mas exige revisão: a revisão local antiga não comprovava
  // uma versão remota. Nunca adivinhar uma base e sobrescrever outro aparelho.
  const grouped = new Set((await tx.getAllAsync('SELECT queue_ids FROM sync_batches')).flatMap(b => JSON.parse(b.queue_ids)));
  for (const uid of new Set(pending.filter(q => !grouped.has(q.operation_id)).map(q => q.account_uid))) {
    const rows = pending.filter(q => q.account_uid === uid && !grouped.has(q.operation_id));
    const operationId = newId();
    const message = 'Alterações da etapa 1 preservadas. Revise e reaplique sobre o catálogo remoto.';
    await tx.runAsync("INSERT INTO sync_batches(operation_id,account_uid,queue_ids,payload,status,last_error) VALUES (?,?,?,?,'rejeitada',?)", operationId, uid, JSON.stringify(rows.map(r => r.operation_id)), JSON.stringify({protocol:1,operation_id:operationId,changes:rows.map(r=>({...r,payload:JSON.parse(r.payload)}))}), message);
    for (const row of rows) await tx.runAsync("UPDATE sync_queue SET status='rejeitada',last_error=? WHERE operation_id=?", message, row.operation_id);
  }
  await setting(tx, 'sync_v2_initialized', 1);
}

export async function materializeCatalog(tx, accountUid) {
  const records = new Map((await tx.getAllAsync('SELECT * FROM sync_entities')).map(r => [`${r.entity_type}:${r.entity_id}`, { table:r.entity_type, row:JSON.parse(r.payload) }]));
  if (accountUid) for (const q of await tx.getAllAsync('SELECT * FROM sync_queue WHERE account_uid=? ORDER BY rowid', accountUid)) {
    const row = JSON.parse(q.payload);
    if (q.entity_type.startsWith('avaliacoes_') && row.autor_id) {
      const parent = q.entity_type === 'avaliacoes_bares' ? 'bar_id' : 'item_id';
      for (const record of records.values()) if (record.table === q.entity_type && record.row.id !== row.id && record.row.autor_id === row.autor_id && record.row[parent] === row[parent]) {
        record.row.deleted_at = new Date().toISOString();
      }
    }
    if (q.entity_type === 'bares' && q.operation === 'create') row.proprietarios = [accountUid];
    else if (q.entity_type === 'bares') row.proprietarios = records.get(`bares:${q.entity_id}`)?.row.proprietarios || [];
    records.set(`${q.entity_type}:${q.entity_id}`, {table:q.entity_type,row});
  }
  const now = new Date().toISOString();
  // Marcar antes de inserir evita a unicidade parcial contra uma opinião local
  // de outra conta. Históricos e tombstones continuam preservados.
  for (const table of TABLES) await tx.runAsync(`UPDATE ${table} SET deleted_at=COALESCE(deleted_at,?)`, now);
  await tx.runAsync('UPDATE bar_proprietarios SET deleted_at=COALESCE(deleted_at,?)', now);
  const allowedColumns = {};
  for (const table of TABLES) allowedColumns[table] = (await tx.getAllAsync(`PRAGMA table_info(${table})`)).map(c=>c.name);
  for (const table of TABLES) for (const {table: type, row} of records.values()) {
    if (type !== table) continue;
    const {proprietarios, ...data} = row;
    // Só colunas SQL conhecidas: metadados do protocolo não viram SQL dinâmico.
    const columns = allowedColumns[table].filter(c => Object.hasOwn(data,c));
    if (data.autor_id) await tx.runAsync("INSERT OR IGNORE INTO usuarios(id,usuario,origem,created_at,updated_at) VALUES (?,?,'firebase',?,?)", data.autor_id, data.autor_nome || 'Usuário', now, now);
    await tx.runAsync(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')}) ON CONFLICT(id) DO UPDATE SET ${columns.filter(c=>c!=='id').map(c=>`${c}=excluded.${c}`).join(',')}`, ...columns.map(c=>data[c] ?? null));
    if (table === 'bares') for (const uid of proprietarios || []) {
      await tx.runAsync("INSERT OR IGNORE INTO usuarios(id,usuario,origem,created_at,updated_at) VALUES (?,?,'firebase',?,?)", uid, 'Usuário', now, now);
      await tx.runAsync('INSERT INTO bar_proprietarios(bar_id,usuario_id,created_at,updated_at,deleted_at) VALUES (?,?,?,?,NULL) ON CONFLICT(bar_id,usuario_id) DO UPDATE SET deleted_at=NULL,updated_at=excluded.updated_at', row.id, uid, now, now);
    }
  }
}

export async function saveRecords(tx, changes) {
  for (const c of changes) {
    if (!TABLES.includes(c.entity_type)) throw new Error('Entidade remota inválida.');
    const row = {...c.record,deleted_at:c.record?.deleted_at ?? null};
    if (!row || row.id !== c.entity_id || !Number.isInteger(row.version) || row.version < 1) throw new Error('Registro remoto inválido.');
    if (['bares','itens_cardapio'].includes(c.entity_type)) row.foto ??= null;
    if (c.entity_type === 'bares') { row.latitude ??= null; row.longitude ??= null; row.criado_por ??= null; }
    else if (c.entity_type.startsWith('avaliacoes_')) row.autor_id ??= null;
    await tx.runAsync('INSERT INTO sync_entities(entity_type,entity_id,payload,version) VALUES (?,?,?,?) ON CONFLICT(entity_type,entity_id) DO UPDATE SET payload=excluded.payload,version=excluded.version WHERE excluded.version >= sync_entities.version', c.entity_type, row.id, JSON.stringify(row), row.version);
  }
}

export async function saveSnapshot(tx, snapshot, uid) {
  if (snapshot.protocol !== 1 || !Number.isSafeInteger(snapshot.sequence) || snapshot.sequence < 0 || !snapshot.entities) throw new Error('Snapshot inválido.');
  await tx.runAsync('DELETE FROM sync_entities');
  for (const table of TABLES) await saveRecords(tx, Object.values(snapshot.entities[table] || {}).map(record => ({entity_type:table,entity_id:record.id,record})));
  await setting(tx, 'sync_cursor', snapshot.sequence);
  await setting(tx, 'sync_snapshot', 1);
  await materializeCatalog(tx, uid);
  await saveRemoteHistory(tx, snapshot.history || []);
}

export async function saveRemoteHistory(tx, changes) {
  for (const c of changes) {
    if (!TABLES.includes(c.entity_type) || !c.before || c.operation !== 'update') continue;
    const old = c.before;
    const snapshot = {...old,data:old.updated_at,...(old.valor_centavos === undefined ? {} : {valor:old.valor_centavos/100})};
    await tx.runAsync(`INSERT OR IGNORE INTO ${c.entity_type}_historico(id,entidade_id,actor_id,acao,snapshot_json,created_at) VALUES (?,?,NULL,'update',?,?)`,
      `remote:${c.entity_type}:${c.entity_id}:${c.record.version}`, c.entity_id, JSON.stringify(snapshot), c.record.updated_at);
  }
}

export async function confirmBatch(tx, batch, receipt) {
  if (receipt.operation_id !== batch.operation_id) throw new Error('Confirmação inválida.');
  await saveRecords(tx, receipt.changes);
  for (const id of JSON.parse(batch.queue_ids)) await tx.runAsync('DELETE FROM sync_queue WHERE operation_id=? AND account_uid=?', id, batch.account_uid);
  await tx.runAsync('DELETE FROM sync_batches WHERE operation_id=? AND account_uid=?', batch.operation_id, batch.account_uid);
  // Não avançar cursor aqui: eventos intermediários ainda podem faltar.
}

export async function failBatch(tx, batch, error, now = Date.now()) {
  const status = error.status === 409 ? 'conflito' : [403, 413, 422, 400].includes(error.status) ? 'rejeitada' : 'pendente';
  const message = error.message || 'Falha temporária';
  await tx.runAsync('UPDATE sync_batches SET status=?,attempts=attempts+1,last_error=?,next_attempt_at=? WHERE operation_id=?', status, message, now + Math.min(300000, 1000 * 2 ** Math.min(batch.attempts, 8)), batch.operation_id);
  for (const id of JSON.parse(batch.queue_ids)) await tx.runAsync('UPDATE sync_queue SET status=?,attempts=attempts+1,last_error=? WHERE operation_id=?', status, message, id);
  if (status !== 'pendente') await tx.runAsync('INSERT OR REPLACE INTO sync_conflicts(operation_id,account_uid,local_json,remote_json,created_at) VALUES (?,?,?,?,?)', batch.operation_id, batch.account_uid, batch.payload, JSON.stringify(error.body || {}), new Date(now).toISOString());
  return status;
}

export async function discardPending(tx, uid) {
  // Chamada somente após confirmação explícita na tela. O registro de conflito
  // preserva a proposta local para inspeção técnica posterior.
  const batches = await tx.getAllAsync('SELECT * FROM sync_batches WHERE account_uid=?', uid);
  for (const b of batches) await tx.runAsync('INSERT OR IGNORE INTO sync_conflicts(operation_id,account_uid,local_json,remote_json,created_at) VALUES (?,?,?,?,?)', b.operation_id, uid, b.payload, JSON.stringify({code:'discarded_by_user'}), new Date().toISOString());
  await tx.runAsync('DELETE FROM sync_queue WHERE account_uid=?', uid);
  await tx.runAsync('DELETE FROM sync_batches WHERE account_uid=?', uid);
  await materializeCatalog(tx, uid);
}

export { setting as saveSetting };
