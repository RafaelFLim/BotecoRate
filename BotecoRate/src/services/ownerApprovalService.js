import { get, onValue, ref, update } from 'firebase/database';
import { randomUUID } from 'expo-crypto';
import NetInfo from '@react-native-community/netinfo';
import { auth, db, requireFirebase } from './firebaseConfig';
import { getActiveUser } from './authService';
import { podeInteragir } from '../utils/permissoes';
import { initDatabase, writeTransaction } from '../database/database';
import { planAccessChange } from './adminProtocol';
import { isValidCnpj, normalizeCnpj, ownerApprovalUpdates } from './ownerApprovalProtocol';
import { normalizeCnpjBatch, writeCnpjDecision } from './cnpjProtocol';

function session(admin) {
  const user = getActiveUser();
  if (!podeInteragir(user) || auth.currentUser?.uid !== user.id || (admin && user.papel !== 'admin')) {
    throw new Error('Entre com uma conta autorizada e e-mail verificado.');
  }
  return user.id;
}
const read = async path => (await get(ref(db, `v1/${path}`))).val();
async function online(admin) {
  requireFirebase();
  const actor = session(admin);
  const network = await NetInfo.fetch();
  if (!network.isConnected || network.isInternetReachable === false) throw new Error('Conecte-se à internet para consultar ou alterar a solicitação.');
  return actor;
}
function sameSession(actor, admin) {
  if (session(admin) !== actor) throw new Error('A conta mudou durante a operação.');
}
function text(value, min, max, message) {
  const clean = value.trim();
  if (clean.length < min || clean.length > max) throw new Error(message);
  return clean;
}

export async function loadOwnerApprovals(admin) {
  const actor = await online(admin);
  const path = admin ? '' : `/${actor}`;
  const [requests, history] = await Promise.all([read(`owner_approvals${path}`), read(`owner_approval_history${path}`)]);
  sameSession(actor, admin);
  const rows = admin ? requests || {} : requests ? { [actor]:requests } : {};
  const events = admin ? history || {} : { [actor]:history || {} };
  await writeTransaction(async tx => {
    for (const [uid, versions] of Object.entries(events)) {
      for (const record of Object.values(versions)) {
        await tx.runAsync('INSERT OR IGNORE INTO validacao_dono_historico(uid,version,status,actor_id,created_at) VALUES (?,?,?,?,?)',
          uid,record.version,record.status,record.updated_by,record.updated_at);
      }
    }
  });
  sameSession(actor, admin);
  return Object.entries(rows).map(([uid, request]) => ({ uid, ...request, history:Object.values(events[uid] || {}) }))
    .sort((a,b) => b.updated_at.localeCompare(a.updated_at) || a.uid.localeCompare(b.uid));
}

export async function submitOwnerApproval({ cnpj, business, reason }) {
  if (!isValidCnpj(cnpj)) throw new Error('Informe um CNPJ válido. Confira os dois dígitos verificadores.');
  const actor = await online(false);
  const previous = await read(`owner_approvals/${actor}`);
  if (['pendente','aprovada'].includes(previous?.status)) throw new Error('Já existe uma solicitação pendente ou aprovada.');
  const record = {cnpj:normalizeCnpj(cnpj),business:text(business,2,150,'Informe o nome do estabelecimento.'),
    reason:text(reason,5,500,'Descreva como você comprova o vínculo com o estabelecimento.'),
    status:'pendente',version:(previous?.version ?? 0)+1,updated_by:actor,updated_at:new Date().toISOString()};
  sameSession(actor, false);
  await update(ref(db,'v1'),ownerApprovalUpdates(actor,record));
}

export async function decideOwnerApproval(request, status, reason) {
  const actor = await online(true);
  const { uid } = request;
  const [previous,access,epoch] = await Promise.all([
    read(`owner_approvals/${uid}`),read(`access_control/${uid}`),read('direct/ownership_epoch'),
  ]);
  if (!previous || previous.version !== request.version) throw new Error('A solicitação foi alterada. Atualize a lista.');
  if (actor === uid || !(previous.status === 'pendente' ? ['aprovada','recusada'].includes(status) : previous.status === 'aprovada' && status === 'revogada')) {
    throw new Error('A decisão não está disponível para esta solicitação.');
  }
  if (status === 'aprovada' && (!isValidCnpj(previous.cnpj) || access?.role === 'admin' || (access && access.status !== 'ativo'))) {
    throw new Error('Confira se o CNPJ é válido e se a conta está ativa e apta à aprovação.');
  }
  const now = new Date().toISOString();
  const record = {...previous,status,version:previous.version+1,updated_by:actor,updated_at:now,
    reason:text(reason,5,500,'Informe uma justificativa de 5 a 500 caracteres.')};
  const changes = ownerApprovalUpdates(uid, record);
  if (status === 'aprovada' && access?.role !== 'dono') {
    Object.assign(changes,planAccessChange(access,{uid,actor,action:'dono',reason:record.reason,operationId:randomUUID(),now,accessEpoch:epoch??0}));
  }
  sameSession(actor, true);
  await update(ref(db,'v1'),changes);
}

export async function loadCnpjOptions({allowOffline=false} = {}) {
  requireFirebase();
  const actor=session(false);
  const key=`cnpj_options:${actor}`;
  const network=await NetInfo.fetch();
  if (!network.isConnected || network.isInternetReachable===false) {
    const cached=allowOffline && await (await initDatabase()).getFirstAsync('SELECT value FROM app_settings WHERE key=?',key);
    sameSession(actor,false);
    if (!cached) throw new Error('Conecte-se para consultar os CNPJs disponíveis.');
    return JSON.parse(cached.value);
  }
  const [initial,extras,usage]=await Promise.all([
    read(`owner_approvals/${actor}`),read(`owner_cnpjs/${actor}`),read(`direct/cnpj_usage/${actor}`),
  ]);
  sameSession(actor,false);
  const result={initial,extras:extras||{},usage:usage||{}};
  await writeTransaction(tx=>tx.runAsync('INSERT OR REPLACE INTO app_settings(key,value) VALUES (?,?)',key,JSON.stringify(result)));
  sameSession(actor,false);
  return result;
}

export async function submitAdditionalCnpjs(values) {
  const cnpjs=normalizeCnpjBatch(values);
  const actor=session(false);
  const {initial,extras,usage}=await loadCnpjOptions();
  if (initial?.status!=='aprovada') throw new Error('A aprovação inicial de dono precisa estar ativa.');
  const updates={};
  const now=new Date().toISOString();
  for (const cnpj of cnpjs) {
    const previous=extras[cnpj];
    if (cnpj===initial.cnpj || usage[cnpj] || (previous && previous.status!=='recusada')) {
      throw new Error(`O CNPJ ${cnpj} já está em análise, aprovado ou vinculado a um bar.`);
    }
    writeCnpjDecision(updates,actor,cnpj,{status:'pendente',version:(previous?.version??0)+1,
      updated_by:actor,updated_at:now,reason:'Solicitação de CNPJ adicional'});
  }
  sameSession(actor,false);
  await update(ref(db,'v1'),updates);
}

export async function loadAdditionalCnpjs() {
  const actor=await online(true);
  const [requests,history,directory]=await Promise.all(['owner_cnpjs','owner_cnpj_history','user_directory'].map(read));
  sameSession(actor,true);
  await writeTransaction(async tx=>{
    for (const [uid,cnpjs] of Object.entries(history||{})) for (const [cnpj,versions] of Object.entries(cnpjs||{})) {
      for (const event of Object.values(versions||{}).filter(Boolean)) {
        await tx.runAsync('INSERT OR IGNORE INTO cnpj_historico(uid,cnpj,version,status,actor_id,reason,created_at) VALUES (?,?,?,?,?,?,?)',
          uid,cnpj,event.version,event.status,event.updated_by,event.reason,event.updated_at);
      }
    }
  });
  sameSession(actor,true);
  return Object.entries(requests||{}).map(([uid,rows])=>({uid,name:directory?.[uid]?.name||uid,
    rows:Object.entries(rows||{}).map(([cnpj,record])=>({cnpj,...record,history:Object.values(history?.[uid]?.[cnpj]||{}).filter(Boolean)}))}));
}

export async function decideAdditionalCnpjs(uid, selected, status, reason) {
  const actor=await online(true);
  const current=await read(`owner_cnpjs/${uid}`)||{};
  const justification=text(reason,5,500,'Informe uma justificativa de 5 a 500 caracteres.');
  if (actor===uid || !['aprovada','recusada'].includes(status) || !selected.length) throw new Error('Selecione os CNPJs pendentes.');
  const updates={};
  const now=new Date().toISOString();
  for (const row of selected) {
    if (current[row.cnpj]?.status!=='pendente' || current[row.cnpj].version!==row.version) throw new Error('Uma solicitação mudou. Atualize a lista.');
    if (status==='aprovada' && !isValidCnpj(row.cnpj)) throw new Error(`O CNPJ ${row.cnpj} é inválido.`);
    writeCnpjDecision(updates,uid,row.cnpj,{status,version:row.version+1,reason:justification,updated_by:actor,updated_at:now});
  }
  sameSession(actor,true);
  await update(ref(db,'v1'),updates);
}

export function watchAdditionalCnpjDecisions(uid, notify) {
  if (!db) return ()=>{};
  let active=true;
  const stop=onValue(ref(db,`v1/owner_cnpjs/${uid}`),snapshot=>{
    const decisions=Object.entries(snapshot.val()||{}).filter(([,row])=>['aprovada','recusada'].includes(row.status));
    if (!decisions.length) return;
    writeTransaction(async tx=>{
      const fresh=[];
      for (const [cnpj,row] of decisions) {
        if (!active || getActiveUser()?.id!==uid) return [];
        const key=`cnpj_result:${uid}:${cnpj}:${row.version}`;
        const result=await tx.runAsync('INSERT OR IGNORE INTO app_settings(key,value) VALUES (?,?)',key,'1');
        if (result.changes) fresh.push({cnpj,...row});
      }
      return fresh;
    }).then(fresh=>{if(active&&getActiveUser()?.id===uid&&fresh.length)notify(fresh);}).catch(()=>{});
  },()=>{});
  return ()=>{active=false;stop();};
}
