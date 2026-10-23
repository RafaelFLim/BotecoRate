import {get,ref,update} from 'firebase/database';
import {randomUUID} from 'expo-crypto';
import NetInfo from '@react-native-community/netinfo';
import {auth,db,requireFirebase} from './firebaseConfig';
import {getActiveUser} from './authService';
import {initDatabase,writeTransaction} from '../database/database';
import {saveOwnership} from '../database/ownershipStore';
import {createOwnershipRequest,actOnOwnershipRequest,ownershipRoleGrant,ownershipVersion} from './ownershipProtocol';

function session() {
  const user=getActiveUser();
  if(!user || user.origem!=='firebase' || !user.emailVerificado || user.status!=='ativo' || auth?.currentUser?.uid!==user.id) throw new Error('Entre com uma conta ativa e e-mail verificado.');
  return user.id;
}
function same(uid) {if(session()!==uid)throw new Error('A conta mudou durante a operação.');}
async function online() {
  requireFirebase();const uid=session(),network=await NetInfo.fetch();
  if(!network.isConnected || network.isInternetReachable===false)throw new Error('Convites e transferências exigem internet para confirmar todos os aceites.');
  return uid;
}
const current=async()=>(await get(ref(db,'v1/direct'))).val()||{};
export async function lookupOwnershipAccount(uid) {
  await online();
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(uid||''))throw new Error('Informe o código de convite (UID) da conta.');
  const card=(await get(ref(db,`v1/ownership_accounts/${uid}`))).val();
  if(!card?.email_verified || card.access?.status==='banido' || card.access?.status==='excluido')throw new Error('Conta não encontrada, inativa ou com e-mail ainda não verificado. Peça que a pessoa entre novamente no app.');
  return card;
}
export async function loadOwnership() {
  const actor=session(),network=await NetInfo.fetch(),key=`ownership_view:${actor}`;
  if(!network.isConnected || network.isInternetReachable===false) {
    const local=await initDatabase(),cached=await local.getFirstAsync('SELECT value FROM app_settings WHERE key=?',key);
    same(actor);if(!cached)throw new Error('Conecte-se uma vez para carregar seus convites e histórico neste aparelho.');
    return {...JSON.parse(cached.value),online:false};
  }
  const state=await current();same(actor);
  const bars=Object.values(state.entities?.bares||{}).filter(b=>b && !b.deleted_at && state.owners?.[b.id]?.[actor]===true).map(b=>({id:b.id,nome:b.nome,owners:Object.keys(state.owners[b.id]).filter(uid=>state.owners[b.id][uid]===true)}));
  const requests=Object.entries(state.ownership_requests||{}).flatMap(([bar,rows])=>Object.values(rows||{}).filter(r=>r?.required_order.includes('|'+actor+'|')).map(r=>({...r,bar_name:state.entities?.bares?.[bar]?.nome||bar,
    stale:r.status==='pendente'&&(r.base_version!==ownershipVersion(state,bar)||(state.ownership_epoch||0)!==r.access_epoch),bar_deleted:Boolean(state.entities?.bares?.[bar]?.deleted_at)})));
  const ids=new Set([actor,...bars.flatMap(b=>b.owners),...requests.flatMap(r=>r.required_order.split('|').filter(Boolean))]);
  const cards=await Promise.all([...ids].map(async uid=>{
    const card=(await get(ref(db,`v1/ownership_accounts/${uid}`))).val();return {uid,name:card?.name||uid};
  }));
  const events=requests.flatMap(r=>Object.values(state.ownership_history?.[r.bar_id]?.[r.id]||{}).filter(Boolean).map(e=>({...e,entity_type:'propriedade',entity_id:r.id,display_name:r.bar_name,operation:'propriedade'})));
  const result={actor,bars,requests,cards,events,online:true};same(actor);
  await writeTransaction(async tx=>{
    same(actor);
    await saveOwnership(tx,state.ownership_requests,state.ownership_history);
    for(const card of cards)await tx.runAsync(`INSERT INTO usuarios(id,usuario,origem,created_at,updated_at) VALUES (?,?,'firebase',?,?) ON CONFLICT(id) DO UPDATE SET usuario=excluded.usuario`,card.uid,card.name,new Date().toISOString(),new Date().toISOString());
    await tx.runAsync('INSERT INTO app_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',key,JSON.stringify(result));
  });same(actor);return result;
}
export async function inviteOwnership({barId,recipient,replaceUid,reason}) {
  const actor=await online();await lookupOwnershipAccount(recipient);same(actor);
  const state=await current();
  const owners=Object.keys(state.owners?.[barId]||{}).filter(uid=>state.owners[barId][uid]===true);
  const cards=await Promise.all(owners.map(lookupOwnershipAccount));
  if(cards.some(card=>!['dono','admin'].includes(card.access?.role)))throw new Error('Um dos donos precisa ter seu acesso regularizado pela administração antes do convite.');
  const updates=createOwnershipRequest(state,{barId,recipient,replaceUid,reason,actor,id:randomUUID(),now:new Date().toISOString()});
  same(actor);await update(ref(db,'v1'),updates);
}
async function attempt(bar,id,actor,action) {
  for(let retry=0;retry<3;retry++) {
    same(actor);const state=await current(),request=state.ownership_requests?.[bar]?.[id];
    if(!request)throw new Error('Solicitação não encontrada.');
    if(action==='aceitar' && request.participants?.[actor]==='aceito')return;
    if(action==='processar' && request.status==='concluida')return;
    if(action==='cancelar' && request.status==='cancelada' && request.created_by===actor)return;
    if(action==='recusar' && request.status==='recusada' && request.participants?.[actor]==='recusado')return;
    if(action==='invalidar' && request.status==='invalidada')return;
    const updates=actOnOwnershipRequest(state,request,{actor,action,now:new Date().toISOString()});
    const access=(await get(ref(db,`v1/ownership_accounts/${request.recipient_uid}/access`))).val();
    const wire=ownershipRoleGrant(updates,access,actor,new Date().toISOString());same(actor);
    try {await update(ref(db,'v1'),wire);return;}
    catch(error) {
      const fresh=await current();same(actor);
      if(retry===2 || fresh.ownership_requests?.[bar]?.[id]?.version===request.version)throw error;
    }
  }
}
export async function answerOwnership(bar,id,action) {
  const actor=await online();await attempt(bar,id,actor,action);
  // Confere assinaturas já recebidas fora de ordem. Cada avanço é versionado.
  for(let step=0;step<32;step++) {
    same(actor);const state=await current(),r=state.ownership_requests?.[bar]?.[id];
    if(r?.status!=='pendente' || r.participants?.[actor]!=='aceito' || r.participants?.[r.next_uid]!=='aceito' || r.base_version!==ownershipVersion(state,bar) || r.access_epoch!==(state.ownership_epoch||0))break;
    await attempt(bar,id,actor,'processar');
  }
}
