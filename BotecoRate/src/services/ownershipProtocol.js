const clone=value=>JSON.parse(JSON.stringify(value));
const ownersOf=(state,bar)=>Object.keys(state.owners?.[bar]||{}).filter(uid=>state.owners[bar][uid]===true).sort();
export function ownershipVersion(state,bar) {return state.ownership_state?.[bar]?.version||0;}
function liveBar(state,bar) {
  if(!state.entities?.bares?.[bar] || state.entities.bares[bar].deleted_at) throw new Error('O bar não está disponível.');
}
function eventUpdates(before,record,actor,vote='nenhum') {
  const snapshot=row=>Object.fromEntries(Object.entries(row).filter(([k])=>k!=='participants'));
  const path=`direct/ownership_requests/${record.bar_id}/${record.id}`;
  const writes=Object.fromEntries(Object.entries(record).filter(([k])=>k!=='participants').map(([k,v])=>[`${path}/${k}`,v]));
  if(vote!=='nenhum') writes[`${path}/participants/${actor}`]=vote;
  return {...writes,
    [`direct/ownership_history/${record.bar_id}/${record.id}/${record.version}`]:{actor_uid:actor,vote,before:before?snapshot(before):{absent:true},record:snapshot(record)}};
}
export function createOwnershipRequest(state,{barId,id,recipient,replaceUid=null,actor,reason,now}) {
  liveBar(state,barId);
  const owners=ownersOf(state,barId);
  if(!owners.includes(actor)) throw new Error('Somente um dono atual pode iniciar a solicitação.');
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(recipient||'') || owners.includes(recipient)) throw new Error('Informe o UID de uma conta que ainda não seja dona deste bar.');
  if(replaceUid && !owners.includes(replaceUid)) throw new Error('Selecione um dos donos atuais para substituir.');
  if(String(reason||'').trim().length<5 || reason.trim().length>500) throw new Error('Descreva o motivo em 5 a 500 caracteres.');
  if(state.ownership_requests?.[barId]?.[id]) throw new Error('Identificador de solicitação já utilizado.');
  const required=state.ownership_state?.[barId]?.owner_order;
  if(!required) throw new Error('Atualize o aplicativo e a estrutura de propriedade deste bar antes de convidar.');
  const record={id,bar_id:barId,kind:replaceUid?'substituir':'adicionar',recipient_uid:recipient,
    ...(replaceUid?{replace_uid:replaceUid}:{}),created_by:actor,created_at:now,updated_at:now,
    updated_by:actor,reason:reason.trim(),base_version:ownershipVersion(state,barId),version:1,status:'pendente',accepted_count:0,access_epoch:state.ownership_epoch||0,required_order:required+recipient+'|',queue:required+recipient+'|',next_uid:required.split('|').filter(Boolean)[0]};
  return eventUpdates(null,record,actor);
}
export function actOnOwnershipRequest(state,request,{actor,action,now}) {
  if(!request || request.status!=='pendente') throw new Error('A solicitação já foi encerrada. Atualize a tela.');
  if(!request.required_order.includes('|'+actor+'|')) throw new Error('Você não participa desta solicitação.');
  const stale=ownershipVersion(state,request.bar_id)!==request.base_version || (state.ownership_epoch||0)!==request.access_epoch;
  if(stale && action!=='invalidar' && action!=='cancelar') throw new Error('A propriedade ou os acessos mudaram. É necessário criar uma nova solicitação.');
  const record={...clone(request),updated_at:now,updated_by:actor,version:request.version+1};
  if(action==='cancelar') {
    if(request.created_by!==actor) throw new Error('Somente quem iniciou pode cancelar.');
    record.status='cancelada';
  } else if(action==='invalidar' && stale) record.status='invalidada';
  else if(action==='processar' && request.participants?.[actor]==='aceito' && request.participants?.[request.next_uid]==='aceito') {}
  else {
    liveBar(state,request.bar_id);
    if(request.participants?.[actor] || !['aceitar','recusar'].includes(action)) throw new Error('Você já respondeu a esta solicitação.');
    record.participants={...(request.participants||{}),[actor]:action==='aceitar'?'aceito':'recusado'};
    if(action==='recusar') record.status='recusada';
    else record.accepted_count++;
  }
  if(record.status==='pendente' && record.participants?.[request.next_uid]==='aceito') {
    record.queue=request.queue.replace('|'+request.next_uid,'');
    record.next_uid=record.queue.split('|').filter(Boolean)[0]||request.recipient_uid;
  }
  const updates={};
  if(record.status==='pendente' && record.queue==='|') {
    record.status='concluida';
    updates[`direct/owners/${request.bar_id}/${request.recipient_uid}`]=true;
    if(request.replace_uid) updates[`direct/owners/${request.bar_id}/${request.replace_uid}`]=null;
    updates[`direct/ownership_state/${request.bar_id}`]={version:request.base_version+1,owner_order:request.kind==='adicionar'?state.ownership_state[request.bar_id].owner_order+request.recipient_uid+'|':state.ownership_state[request.bar_id].owner_order.replace('|'+request.replace_uid+'|','|'+request.recipient_uid+'|'),last_request:request.id,updated_at:now,updated_by:actor};
  }
  return {...updates,...eventUpdates(request,record,actor,['aceitar','recusar'].includes(action)?record.participants[actor]:'nenhum')};
}

// A promoção é estritamente vinculada à conclusão consensual, sem conceder admin.
export function ownershipRoleGrant(updates,access,actor,now) {
  const request=Object.entries(updates).find(([p])=>p.startsWith('direct/ownership_history/'))?.[1]?.record;
  if(request?.status!=='concluida' || (access?.role && access.role!=='comum')) return updates;
  if(access?.status && access.status!=='ativo') throw new Error('A conta convidada não está ativa.');
  const record={role:'dono',status:'ativo',version:(access?.version||0)+1,updated_at:now,updated_by:actor,
    last_operation:request.id,reason:'Vínculo de propriedade aprovado por todos os envolvidos.',ownership_bar:request.bar_id,ownership_request:request.id};
  return {...updates,[`ownership_accounts/${request.recipient_uid}/access`]:{role:'dono',status:'ativo',version:record.version,initialized:true},[`access_control/${request.recipient_uid}`]:record,
    [`access_history/${request.recipient_uid}/${record.version}`]:{actor_uid:actor,before:access?.initialized?{role:access.role,status:access.status,version:access.version,redacted:true}:{absent:true},record}};
}
