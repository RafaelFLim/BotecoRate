// Planejamento puro. A autoridade e a atomicidade são verificadas pelas regras RTDB.
export const REVIEW_TABLES = ['avaliacoes_bares', 'avaliacoes_itens'];
function reasonText(reason) {
  const value = String(reason || '').trim();
  if (value.length < 5 || value.length > 500) throw new Error('Informe uma justificativa entre 5 e 500 caracteres.');
  return value;
}
export function planAccessChange(before, {uid, actor, action, reason, operationId, now, accessEpoch=0}) {
  if (uid === actor) throw new Error('Você não pode alterar seu próprio acesso.');
  const old = before || {role:'comum',status:'ativo'};
  if (old.status === 'excluido' && (action!=='restaurar' || Date.parse(now)>=old.purge_after)) throw new Error('A restauração exige uma conta na lixeira dentro do prazo de 30 dias.');
  let role=old.role, status=old.status;
  if (['comum','dono','admin'].includes(action) && status==='ativo') role=action;
  else if (action==='banir' && status==='ativo') status='banido';
  else if (action==='restaurar' && ['banido','excluido'].includes(status)) status='ativo';
  else if (action==='excluir') status='excluido';
  else throw new Error('Esta ação não está disponível para a conta.');
  if (role===old.role && status===old.status) throw new Error('O acesso já está definido assim.');
  const record={role,status,version:(before?.version||0)+1,updated_at:now,updated_by:actor,
    last_operation:operationId,reason:reasonText(reason),...(status==='excluido'?{deleted_at:now,purge_after:Date.parse(now)+30*86400000}:{})};
  const event={actor_uid:actor,before:before||{absent:true},record};
  return {'direct/ownership_epoch':accessEpoch+1,[`ownership_accounts/${uid}/access`]:{role,status,version:record.version,initialized:true},[`access_control/${uid}`]:record,[`access_history/${uid}/${record.version}`]:event};
}
export function planModeration(before, {table,id,status,actor,reason,operationId,now}) {
  if (!REVIEW_TABLES.includes(table) || !['visivel','oculta','excluida'].includes(status)) throw new Error('Moderação inválida.');
  if (before?.status==='excluida' && (status!=='visivel' || Date.parse(now)>=before.purge_after)) throw new Error('A restauração exige uma avaliação na lixeira dentro do prazo de 30 dias.');
  if ((before?.status||'visivel')===status) throw new Error('A avaliação já está neste estado.');
  const record={status,reason:reasonText(reason),updated_by:actor,updated_at:now,
    version:(before?.version||0)+1,last_operation:operationId,...(status==='excluida'?{deleted_at:now,purge_after:Date.parse(now)+30*86400000}:{})};
  return {[`direct/moderation/${table}/${id}`]:record,
    [`direct/moderation_history/${table}/${id}/${record.version}`]:{actor_uid:actor,before:before||{absent:true},record}};
}
