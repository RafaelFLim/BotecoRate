import NetInfo from '@react-native-community/netinfo';
import { get, ref } from 'firebase/database';
import { randomUUID } from 'expo-crypto';
import { db as remote, firebaseConfigured } from './firebaseConfig';
import { writeTransaction } from '../database/database';
import { getActiveUser } from './authService';
import { notifyCatalog } from './storage';
import { encodePhotoForSync } from './mediaService';
import { isSyncedPhoto } from '../utils/photo';
import { downloadCatalog, sendCommand, assertSession } from './syncTransport';
import { asMap } from './directProtocol';
import { initializeSync, materializeCatalog, saveSnapshot, confirmBatch, failBatch, saveRemoteHistory } from '../database/syncStore';

let running;
let runningAccount;
export function syncCatalog() {
  const uid=getActiveUser()?.id;
  if (running && runningAccount!==uid) return running.catch(()=>{}).then(syncCatalog);
  if (!running) { runningAccount=uid; running=synchronize().finally(()=>{running=null;}); }
  return running;
}
async function freezeCommand(batch,uid) {
  if (batch.wire_payload) return JSON.parse(batch.wire_payload);
  const command=JSON.parse(batch.payload);
  const prepared=new Map();
  for(const c of command.changes) {
    const photo=c.payload.foto;
    if (c.operation==='soft_delete' || !photo || isSyncedPhoto(photo)) continue;
    assertSession(uid);
    if (!prepared.has(photo)) prepared.set(photo,await encodePhotoForSync(photo,uid));
    c.payload.foto=prepared.get(photo);
  }
  assertSession(uid);
  await writeTransaction(tx=>tx.runAsync('UPDATE sync_batches SET wire_payload=? WHERE operation_id=? AND account_uid=?',JSON.stringify(command),batch.operation_id,uid));
  return command;
}
async function pull(uid) {
  const snapshot=await downloadCatalog(uid);
  await writeTransaction(async tx=>{assertSession(uid);await saveSnapshot(tx,snapshot,uid);});
}
async function publicCatalog() {
  const snapshot=await get(ref(remote,'v1/direct/public_bars'));
  if (!snapshot.exists()) return 'Catálogo remoto ainda não publicado';
  const bars=asMap(snapshot.val());
  await writeTransaction(async tx=>{
    for(const bar of Object.values(bars)) {
      if (!bar.id || !bar.nome || !bar.endereco) throw new Error('Bar remoto inválido.');
      const previous=await tx.getFirstAsync("SELECT payload FROM sync_entities WHERE entity_type='bares' AND entity_id=?",bar.id);
      const old=previous?JSON.parse(previous.payload):{};
      const row={...old,...bar,detalhes:old.detalhes||'',criado_por:old.criado_por||null,proprietarios:old.proprietarios||[],
        latitude:bar.latitude??null,longitude:bar.longitude??null,foto:bar.foto||null,
        created_at:old.created_at||new Date().toISOString(),updated_at:old.updated_at||new Date().toISOString(),deleted_at:bar.deleted_at??null};
      await tx.runAsync("INSERT INTO sync_entities(entity_type,entity_id,payload,version) VALUES ('bares',?,?,0) ON CONFLICT(entity_type,entity_id) DO UPDATE SET payload=excluded.payload",bar.id,JSON.stringify(row));
    }
    await materializeCatalog(tx,getActiveUser()?.id||null);
  });
  notifyCatalog();
  return 'Catálogo de endereços atualizado';
}
async function synchronize() {
  await writeTransaction(tx=>initializeSync(tx,randomUUID));
  const state=await NetInfo.fetch();
  if (!state.isConnected || state.isInternetReachable===false) return 'Offline — usando o catálogo deste aparelho';
  if (!firebaseConfigured) return 'Consulta local — Firebase ainda não configurado';
  const user=getActiveUser();
  if (!user || user.origem!=='firebase' || !user.emailVerificado) return publicCatalog();
  const uid=user.id;
  await pull(uid);
  const batches=await writeTransaction(tx=>tx.getAllAsync('SELECT * FROM sync_batches WHERE account_uid=? ORDER BY rowid',uid));
  for(const batch of batches) {
    assertSession(uid);
    if (batch.status!=='pendente' || batch.next_attempt_at>Date.now()) break;
    try {
      const receipt=await sendCommand(uid,await freezeCommand(batch,uid));
      await writeTransaction(async tx=>{
        assertSession(uid);await confirmBatch(tx,batch,receipt);
        for(const id of JSON.parse(batch.queue_ids)) for(const table of ['bares','itens_cardapio','avaliacoes_bares','avaliacoes_itens']) await tx.runAsync(`DELETE FROM ${table}_historico WHERE id=?`,id);
        await materializeCatalog(tx,uid);await saveRemoteHistory(tx,receipt.changes);
      });
    } catch(error) {
      if (error.sessionChanged) throw error;
      await writeTransaction(tx=>failBatch(tx,batch,error));break;
    }
  }
  await pull(uid);notifyCatalog();
  const pending=await writeTransaction(tx=>tx.getAllAsync('SELECT status,COUNT(*) AS total FROM sync_batches WHERE account_uid=? GROUP BY status',uid));
  return pending.length?pending.map(p=>`${p.total} ${p.status==='pendente'?'envio(s) pendente(s)':p.status==='conflito'?'conflito(s) para revisar':'envio(s) rejeitado(s)'}`).join(' · '):'Catálogo sincronizado com o Firebase';
}
