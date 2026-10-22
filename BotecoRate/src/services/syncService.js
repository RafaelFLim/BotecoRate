import NetInfo from '@react-native-community/netinfo';
import { get, ref } from 'firebase/database';
import { randomUUID } from 'expo-crypto';
import { db as remote, firebaseConfigured } from './firebaseConfig';
import { writeTransaction } from '../database/database';
import { getActiveUser } from './authService';
import { notifyCatalog } from './storage';
import { apiRequest, apiUrl, assertSession } from './syncTransport';
import { initializeSync, materializeCatalog, saveSnapshot, confirmBatch, failBatch, saveRecords, saveSetting, saveRemoteHistory } from '../database/syncStore';

let running;
let runningAccount;
export function syncCatalog() {
  const uid = getActiveUser()?.id;
  if (running && runningAccount !== uid) return running.catch(()=>{}).then(syncCatalog);
  if (!running) {
    runningAccount = uid;
    running = synchronize().finally(() => { running = null; });
  }
  return running;
}

async function freezeCommand(batch, uid) {
  if (batch.wire_payload) return JSON.parse(batch.wire_payload);
  const command = JSON.parse(batch.payload);
  const uploaded = new Map();
  for (const c of command.changes) {
    const photo = c.payload.foto;
    if (c.operation === 'soft_delete' || !photo || /^https:\/\//.test(photo)) continue;
    if (!/^file:\/\//.test(photo)) throw Object.assign(new Error('Foto local inválida. Tire uma nova foto.'), {status:422});
    if (!uploaded.has(photo)) {
      const form = new FormData();
      form.append('file', {uri:photo,name:'foto.jpg',type:'image/jpeg'});
      const barId = c.entity_type === 'bares' ? c.entity_id : c.payload.bar_id;
      const isNew = command.changes.some(change => change.entity_type === 'bares' && change.entity_id === barId && change.operation === 'create');
      if (!isNew) form.append('bar_id', barId);
      const result = await apiRequest(uid, '/v1/media', {form});
      uploaded.set(photo, result.url);
    }
    c.payload.foto = uploaded.get(photo);
  }
  assertSession(uid);
  // Salvar antes do primeiro envio garante repetição idêntica após timeout.
  await writeTransaction(tx => tx.runAsync('UPDATE sync_batches SET wire_payload=? WHERE operation_id=? AND account_uid=?', JSON.stringify(command), batch.operation_id, uid));
  return command;
}

async function pull(uid) {
  const initialized = await writeTransaction(tx => tx.getFirstAsync("SELECT value FROM app_settings WHERE key='sync_snapshot'"));
  if (!initialized) {
    const snapshot = await apiRequest(uid, '/v1/sync/snapshot');
    await writeTransaction(async tx => { assertSession(uid); await saveSnapshot(tx, snapshot, uid); });
    return;
  }
  let more = true;
  while (more) {
    const cursor = await writeTransaction(tx => tx.getFirstAsync("SELECT value FROM app_settings WHERE key='sync_cursor'"));
    let page;
    try { page = await apiRequest(uid, '/v1/sync/events?after=' + Number(cursor?.value || 0)); }
    catch (error) {
      if (error.body?.code !== 'cursor_expired') throw error;
      const snapshot = await apiRequest(uid, '/v1/sync/snapshot');
      await writeTransaction(async tx => { assertSession(uid); await saveSnapshot(tx, snapshot, uid); });
      return;
    }
    await writeTransaction(async tx => {
      assertSession(uid);
      let sequence = Number(cursor?.value || 0);
      if (page.protocol !== 1 || !Array.isArray(page.events)) throw new Error('Página de sincronização inválida.');
      for (const event of page.events) {
        if (event.sequence !== sequence + 1) throw new Error('Sequência de sincronização incompleta.');
        await saveRecords(tx, event.changes);
        sequence = event.sequence;
      }
      if (page.sequence !== sequence || (page.has_more && !page.events.length)) throw new Error('Cursor remoto inválido.');
      await saveSetting(tx, 'sync_cursor', sequence);
      await materializeCatalog(tx, uid);
      for (const event of page.events) await saveRemoteHistory(tx, event.changes);
    });
    more = page.has_more;
  }
}

async function publicCatalog() {
  const snapshot = await get(ref(remote, 'v1/catalog'));
  if (!snapshot.exists()) return 'Catálogo remoto ainda não publicado';
  const data = snapshot.val();
  // RTDB remove arrays vazios: ausência de bares equivale a catálogo vazio.
  if (!Number.isSafeInteger(data.version) || (data.bares && !Array.isArray(data.bares))) throw new Error('Catálogo remoto inválido.');
  await writeTransaction(async tx => {
    const version = await tx.getFirstAsync("SELECT value FROM app_settings WHERE key='public_catalog_version'");
    const cursor = await tx.getFirstAsync("SELECT value FROM app_settings WHERE key='sync_cursor'");
    if (Number(version?.value || -1) >= data.version || Number(cursor?.value || -1) > data.version) return;
    const activeIds = new Set((data.bares || []).map(b=>b.id));
    for (const existing of await tx.getAllAsync("SELECT * FROM sync_entities WHERE entity_type='bares'")) {
      if (activeIds.has(existing.entity_id)) continue;
      const row = {...JSON.parse(existing.payload),deleted_at:new Date().toISOString()};
      await tx.runAsync("UPDATE sync_entities SET payload=? WHERE entity_type='bares' AND entity_id=?", JSON.stringify(row), existing.entity_id);
    }
    for (const bar of data.bares || []) {
      if (!bar.id || !bar.nome || !bar.endereco) throw new Error('Bar remoto inválido.');
      const previous = await tx.getFirstAsync("SELECT payload FROM sync_entities WHERE entity_type='bares' AND entity_id=?", bar.id);
      const old = previous ? JSON.parse(previous.payload) : {};
      if (old.deleted_at) continue;
      const row = {...old,...bar,detalhes:old.detalhes || '',criado_por:old.criado_por || null,
        latitude:bar.latitude ?? null,longitude:bar.longitude ?? null,foto:bar.foto || null,
        created_at:old.created_at || new Date().toISOString(),updated_at:old.updated_at || new Date().toISOString(),deleted_at:null,version:old.version || 1};
      await tx.runAsync("INSERT INTO sync_entities(entity_type,entity_id,payload,version) VALUES ('bares',?,?,0) ON CONFLICT(entity_type,entity_id) DO UPDATE SET payload=excluded.payload", bar.id, JSON.stringify(row));
    }
    await saveSetting(tx, 'public_catalog_version', data.version);
  });
  return 'Catálogo de endereços atualizado';
}

async function synchronize() {
  await writeTransaction(tx => initializeSync(tx, randomUUID));
  const state = await NetInfo.fetch();
  if (!state.isConnected || state.isInternetReachable === false) return 'Offline — usando o catálogo deste aparelho';
  if (!firebaseConfigured) return 'Consulta local — Firebase ainda não configurado';
  const user = getActiveUser();
  if (!user || user.origem !== 'firebase' || !user.emailVerificado) return publicCatalog();
  if (!apiUrl) return 'Alterações guardadas neste aparelho — configure a API para sincronizar';
  const uid = user.id;
  await pull(uid);
  const batches = await writeTransaction(tx => tx.getAllAsync('SELECT * FROM sync_batches WHERE account_uid=? ORDER BY rowid', uid));
  let blocked = false;
  for (const batch of batches) {
    assertSession(uid);
    // Uma falha interrompe a fila da conta, preservando a ordem causal.
    if (batch.status !== 'pendente' || batch.next_attempt_at > Date.now() || blocked) { blocked = true; continue; }
    try {
      const body = await freezeCommand(batch, uid);
      const receipt = await apiRequest(uid, '/v1/sync/commands', {body});
      await writeTransaction(async tx => {
        assertSession(uid);
        await confirmBatch(tx, batch, receipt);
        // A confirmação substitui a auditoria provisória da mesma operação.
        for (const id of JSON.parse(batch.queue_ids)) for (const table of ['bares','itens_cardapio','avaliacoes_bares','avaliacoes_itens']) {
          await tx.runAsync(`DELETE FROM ${table}_historico WHERE id=?`, id);
        }
        await materializeCatalog(tx, uid);
        await saveRemoteHistory(tx, receipt.changes);
      });
    } catch (error) {
      if (error.sessionChanged) throw error;
      await writeTransaction(tx => failBatch(tx, batch, error));
      blocked = true;
      if ([401, 403].includes(error.status)) break;
    }
  }
  await pull(uid);
  notifyCatalog();
  const pending = await writeTransaction(tx => tx.getAllAsync('SELECT status,COUNT(*) AS total FROM sync_batches WHERE account_uid=? GROUP BY status', uid));
  return pending.length ? pending.map(p=>`${p.total} ${p.status === 'pendente' ? 'envio(s) pendente(s)' : p.status === 'conflito' ? 'conflito(s) para revisar' : 'envio(s) rejeitado(s)'}`).join(' · ') : 'Catálogo sincronizado';
}
