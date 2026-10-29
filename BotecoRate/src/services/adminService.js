import { get, ref, update } from 'firebase/database';
import { randomUUID } from 'expo-crypto';
import NetInfo from '@react-native-community/netinfo';
import { writeTransaction } from '../database/database';
import { auth, db, requireFirebase } from './firebaseConfig';
import { getActiveUser } from './authService';
import { planAccessChange, planModeration, REVIEW_TABLES } from './adminProtocol';
import { attachHistoryContexts } from '../utils/historyFilters';

function sameSession(uid) {
  const active=getActiveUser();
  if(auth.currentUser?.uid!==uid || active?.id!==uid || active.origem!=='firebase' || active.papel!=='admin' || active.status!=='ativo' || !active.emailVerificado) throw new Error('A sessão administrativa mudou. Entre novamente.');
}
async function administrator() {
  requireFirebase();
  const network=await NetInfo.fetch();
  if (!network.isConnected || network.isInternetReachable===false) throw new Error('O painel administrativo exige internet.');
  const user=auth.currentUser;
  if (!user?.emailVerified) throw new Error('Entre com uma conta administrativa com e-mail verificado.');
  sameSession(user.uid);
  const access=(await get(ref(db,`v1/access_control/${user.uid}`))).val();
  if (auth.currentUser?.uid!==user.uid || access?.role!=='admin' || access.status!=='ativo') throw new Error('Acesso administrativo indisponível.');
  sameSession(user.uid);
  return user.uid;
}
export async function loadAdministration() {
  const actor=await administrator();
  const values=await Promise.all(['user_directory','access_control','access_history','direct','public_profiles','profile_history'].map(path=>get(ref(db,`v1/${path}`)).then(s=>s.val()||{})));
  sameSession(actor);
  const [directory,access,history,direct,profiles,profileHistory]=values;
  const events=[];
  for(const [uid,versions] of Object.entries(profileHistory)) for(const [version,event] of Object.entries(versions||{})) {
    if(!event)continue;
    const nextName=profiles[uid]?.version===Number(version)?profiles[uid].name:versions[Number(version)+1]?.name;
    events.push({entity_type:'usuarios',entity_id:uid,actor_uid:uid,operation:'perfil',before:{name:event.name},
      record:{name:nextName||'Não disponível no histórico legado',version:Number(version),updated_at:event.date}});
  }
  for(const [uid,versions] of Object.entries(history)) for(const [version,e] of Object.entries(versions||{})) {
    if(e) events.push({...e,entity_type:'usuarios',entity_id:uid,operation:'acesso'});
  }
  await writeTransaction(async tx=>{
    for(const u of Object.values(directory).filter(Boolean)) await tx.runAsync(`INSERT INTO usuarios(id,usuario,origem,created_at,updated_at) VALUES (?,?,'firebase',?,?) ON CONFLICT(id) DO UPDATE SET usuario=excluded.usuario`,u.uid,u.name,u.updated_at,u.updated_at);
    for(const e of events.filter(event=>event.operation==='acesso')) await tx.runAsync('INSERT OR IGNORE INTO admin_access_historico(id,entity_id,actor_id,reason,before_json,after_json,created_at) VALUES (?,?,?,?,?,?,?)',
      `${e.entity_id}:${e.record.version}`,e.entity_id,e.actor_uid,e.record.reason,JSON.stringify(e.before),JSON.stringify(e.record),e.record.updated_at);
    for(const e of events.filter(event=>event.operation==='perfil')) {
      await tx.runAsync("INSERT OR IGNORE INTO usuarios(id,usuario,origem,created_at,updated_at) VALUES (?,?,'firebase',?,?)",e.entity_id,directory[e.entity_id]?.name||e.record.name,e.record.updated_at,e.record.updated_at);
      await tx.runAsync('INSERT OR IGNORE INTO usuarios_historico(id,usuario_id,actor_id,acao,snapshot_json,created_at) VALUES (?,?,?,?,?,?)',`profile:${e.entity_id}:${e.record.version}`,e.entity_id,e.actor_uid,'update',JSON.stringify({usuario:e.before.name}),e.record.updated_at);
    }
  });
  for(const table of ['bares','itens_cardapio',...REVIEW_TABLES]) for(const [id,versions] of Object.entries(direct.history?.[table]||{})) {
    for(const e of Object.values(versions||{})) if(e)events.push({...e,entity_type:table,entity_id:id});
  }
  for(const table of REVIEW_TABLES) for(const [id,versions] of Object.entries(direct.moderation_history?.[table]||{})) {
    for(const e of Object.values(versions||{})) if(e)events.push({...e,entity_type:table,entity_id:id,operation:'moderacao'});
  }
  for(const [bar,requests] of Object.entries(direct.ownership_history||{})) for(const [id,versions] of Object.entries(requests||{})) {
    for(const e of Object.values(versions||{})) if(e)events.push({...e,bar_id:bar,entity_type:'propriedade',entity_id:id,operation:'propriedade',display_name:direct.entities?.bares?.[bar]?.nome||bar});
  }
  for(const e of events) {
    const row=direct.entities?.[e.entity_type]?.[e.entity_id]||e.record;
    e.display_name=e.display_name || (e.entity_type==='usuarios'?directory[e.entity_id]?.name:row.nome||direct.entities?.bares?.[row.bar_id]?.nome||direct.entities?.itens_cardapio?.[row.item_id]?.nome);
  }
  sameSession(actor);
  return {actor,events:attachHistoryContexts(events,direct),users:Object.entries(directory).filter(([,u])=>u).map(([uid,u])=>({...u,uid,access:access[uid]||{role:'comum',status:'ativo'},history:Object.values(history[uid]||{})})),
    reviews:REVIEW_TABLES.flatMap(table=>Object.values(direct.entities?.[table]||{}).filter(r=>r && !r.deleted_at).map(r=>({...r,table,
      target:table==='avaliacoes_bares'?direct.entities?.bares?.[r.bar_id]?.nome:direct.entities?.itens_cardapio?.[r.item_id]?.nome,
      moderation:direct.moderation?.[table]?.[r.id],history:Object.values(direct.moderation_history?.[table]?.[r.id]||{})}))) };
}
export async function changeUserAccess(uid,action,reason) {
  const actor=await administrator();
  const before=(await get(ref(db,`v1/access_control/${uid}`))).val();
  const accessEpoch=(await get(ref(db,'v1/direct/ownership_epoch'))).val()||0;
  const updates=planAccessChange(before,{uid,actor,action,reason,accessEpoch,operationId:randomUUID(),now:new Date().toISOString()});
  sameSession(actor);
  await update(ref(db,'v1'),updates);
}
export async function moderateReview(table,id,status,reason) {
  const actor=await administrator();
  const before=(await get(ref(db,`v1/direct/moderation/${table}/${id}`))).val();
  const updates=planModeration(before,{table,id,status,actor,reason,operationId:randomUUID(),now:new Date().toISOString()});
  sameSession(actor);
  await update(ref(db,'v1'),updates);
}
