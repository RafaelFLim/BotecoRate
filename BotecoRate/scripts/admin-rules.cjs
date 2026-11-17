// As regras de auditoria comparam todos os campos antes/depois da escrita atômica.
module.exports = function addAdminRules(v1, active, admin) {
  const {grantCondition}=require('./ownership-rules.cjs');
  const allowed=`(${active}) && (${admin})`;
  const eq=(a,b,fields)=>fields.map(k=>`${a}.child('${k}').val() === ${b}.child('${k}').val()`).join(' && ');
  const string=(min,max)=>`newData.isString() && newData.val().length >= ${min} && newData.val().length <= ${max}`;
  function audited({fields,old,after,eventAfter,historyAfter,permission,validation}) {
    const node={'.write':`${permission} && newData.exists()`,'.validate':[
      `newData.hasChildren(${JSON.stringify(fields.filter(k=>!['deleted_at','purge_after','ownership_bar','ownership_request'].includes(k)))})`,
      `newData.child('version').val() === (data.child('version').exists() ? data.child('version').val()+1 : 1)`,
      `newData.child('updated_by').val() === auth.uid`,
      `${historyAfter}.child('actor_uid').val() === auth.uid`,validation,
    ].join(' && ')};
    for(const k of fields) node[k]={'.validate': k==='version'?'newData.isNumber() && newData.val() % 1 === 0':k==='purge_after'?'newData.isNumber()':k==='reason'?string(5,500):string(1,128)};
    node.$other={'.validate':false};
    const grant=fields.includes('role')?grantCondition("newData.child('record')",`${after}.parent().parent()`):'false';
    const audit={'.write':`((${allowed}) || ((${active}) && ${grant})) && !data.exists() && newData.exists()`,'.validate':[
      "newData.hasChildren(['actor_uid','before','record']) && newData.child('actor_uid').val() === auth.uid",
      `$version === '' + ${after}.child('version').val()`,
      `${after}.child('version').val() === (${old}.child('version').exists() ? ${old}.child('version').val()+1 : 1)`,
      `(${old}.exists() ? (!newData.child('before/absent').exists() && ((${grant} && newData.child('before/redacted').val() === true && newData.child('before/role').val() === ${old}.child('role').val() && newData.child('before/status').val() === ${old}.child('status').val() && newData.child('before/version').val() === (${old}.child('version').exists() ? ${old}.child('version').val() : 0)) || (${eq("newData.child('before')",old,fields)}))) : newData.child('before/absent').val() === true)`,
      eq("newData.child('record')",after,fields),
      // A standalone history insertion cannot fabricate a state transition.
      `${eventAfter}.child('actor_uid').val() === auth.uid`,
    ].join(' && '),actor_uid:{'.validate':string(1,128)},$other:{'.validate':false}};
    for(const name of ['before','record']) {audit[name]={$other:{'.validate':false}};for(const k of [...fields,'absent','redacted']) audit[name][k]={'.validate':true};}
    return {node,audit};
  }
  const accessFields=['role','status','version','updated_at','updated_by','last_operation','reason','deleted_at','purge_after','ownership_bar','ownership_request'];
  const accessOld="root.child('v1/access_control').child($uid)";
  const accessAfter="newData.parent().parent().parent().child('access_control').child($uid)";
  const accessHistory="newData.parent().parent().child('access_history').child($uid).child(''+newData.child('version').val())";
  const access=audited({fields:accessFields,old:accessOld,after:accessAfter,
    eventAfter:'newData',historyAfter:accessHistory,
    permission:`((${allowed} && auth.uid !== $uid) || (${active} && ${grantCondition('newData','newData.parent().parent()')})) && root.child('v1/user_directory').child($uid).exists()`,
    validation:[
      "(newData.child('role').val() === 'comum' || newData.child('role').val() === 'dono' || newData.child('role').val() === 'admin')",
      "(newData.child('status').val() === 'ativo' || newData.child('status').val() === 'banido' || newData.child('status').val() === 'excluido')",
      "(!data.child('deleted_at').exists() || (now < data.child('purge_after').val() && newData.child('status').val() === 'ativo'))",
      "(newData.child('role').val() === (data.exists()?data.child('role').val():'comum') ? newData.child('status').val() !== (data.exists()?data.child('status').val():'ativo') : newData.child('status').val() === 'ativo' && (!data.exists() || data.child('status').val() === 'ativo'))",
      "(newData.child('role').val() === (data.exists()?data.child('role').val():'comum') || newData.child('role').val() === 'comum' || root.child('v1/user_directory').child($uid).child('email_verified').val() === true)",
      "(newData.child('status').val() === 'excluido' ? newData.child('deleted_at').val() === newData.child('updated_at').val() && newData.child('purge_after').val() >= now + 2591940000 && newData.child('purge_after').val() <= now + 2592060000 : !newData.child('deleted_at').exists() && !newData.child('purge_after').exists())",
    ].join(' && ')});
  const mirror="newData.parent().parent().child('ownership_accounts').child($uid).child('access')";
  access.node['.validate']+=` && ${mirror}.child('role').val() === newData.child('role').val() && ${mirror}.child('status').val() === newData.child('status').val() && ${mirror}.child('version').val() === newData.child('version').val() && ${mirror}.child('initialized').val() === true`;
  const futureEpoch="newData.parent().parent().child('direct/ownership_epoch')";
  const oldEpoch="(root.child('v1/direct/ownership_epoch').exists() ? root.child('v1/direct/ownership_epoch').val() : 0)";
  access.node['.validate']+=` && (${grantCondition('newData','newData.parent().parent()')} ? (${futureEpoch}.exists() ? ${futureEpoch}.val() : 0) === ${oldEpoch} : ${futureEpoch}.val() === ${oldEpoch}+1)`;
  v1.access_control={'.read':allowed,$uid:{'.read':'auth != null && auth.uid === $uid',...access.node}};
  v1.access_history={'.read':allowed,$uid:{$version:access.audit}};
  const own="auth != null && auth.uid === $uid && (!root.child('v1/access_control').child(auth.uid).exists() || root.child('v1/access_control').child(auth.uid).child('status').val() === 'ativo')";
  v1.user_directory={'.read':allowed,$uid:{'.read':'auth != null && auth.uid === $uid',
    '.write':`${own} && newData.exists()`,
    '.validate':"newData.hasChildren(['uid','name','email','email_verified','updated_at']) && newData.child('uid').val() === $uid && newData.child('email').val() === auth.token.email && newData.child('email_verified').val() === auth.token.email_verified",
    uid:{'.validate':string(1,128)},name:{'.validate':string(1,100)},email:{'.validate':string(1,320)},email_verified:{'.validate':'newData.isBoolean()'},updated_at:{'.validate':string(1,128)},$other:{'.validate':false}}};
  v1.direct.moderation={};v1.direct.moderation_history={};
  for(const table of ['avaliacoes_bares','avaliacoes_itens']) {
    const fields=['status','reason','updated_by','updated_at','version','last_operation','deleted_at','purge_after'];
    const old=`root.child('v1/direct/moderation/${table}').child($id)`;
    const after=`newData.parent().parent().parent().parent().child('moderation/${table}').child($id)`;
    const historyAfter=`newData.parent().parent().parent().child('moderation_history/${table}').child($id).child(''+newData.child('version').val())`;
    const rules=audited({fields,old,after,eventAfter:'newData',historyAfter,
      permission:`${allowed} && root.child('v1/direct/entities/${table}').child($id).exists() && !root.child('v1/direct/entities/${table}').child($id).child('deleted_at').exists()`,
      validation:"(!data.child('deleted_at').exists() || (now < data.child('purge_after').val() && newData.child('status').val() === 'visivel')) && (newData.child('status').val() === 'visivel' || newData.child('status').val() === 'oculta' || newData.child('status').val() === 'excluida') && newData.child('status').val() !== (data.exists()?data.child('status').val():'visivel') && (newData.child('status').val() === 'excluida' ? newData.child('deleted_at').val() === newData.child('updated_at').val() && newData.child('purge_after').val() >= now + 2591940000 && newData.child('purge_after').val() <= now + 2592060000 : !newData.child('deleted_at').exists() && !newData.child('purge_after').exists())"});
    v1.direct.moderation[table]={$id:rules.node};v1.direct.moderation_history[table]={$id:{$version:rules.audit}};
    const future="newData.parent().parent().parent()";
    const item=table==='avaliacoes_itens'?`${future}.child('entities/itens_cardapio').child(newData.child('item_id').val())`:null;
    const barId=item?`${item}.child('bar_id').val()`:"newData.child('bar_id').val()";
    const cascade=`newData.child('deleted_at').exists() && (${future}.child('entities/bares').child(${barId}).child('deleted_at').exists()${item?` || ${item}.child('deleted_at').exists()`:''})`;
    v1.direct.entities[table].$id['.write']+=` && (!root.child('v1/direct/moderation/${table}').child($id).exists() || root.child('v1/direct/moderation/${table}').child($id).child('status').val() === 'visivel' || (${cascade}))`;
  }
};
