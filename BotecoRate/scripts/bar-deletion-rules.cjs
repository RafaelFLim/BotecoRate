module.exports = function addBarDeletionRules(direct, active, admin) {
  const base = "root.child('v1/direct')";
  const bar = `${base}.child('entities/bares').child($bar)`;
  const state = `${base}.child('ownership_state').child($bar)`;
  const role = "root.child('v1/access_control').child(auth.uid).child('role').val()";
  const owner = `${base}.child('owners').child($bar).child(auth.uid).val() === true && (${role} === 'dono' || ${role} === 'admin')`;
  const epoch = `(${base}.child('ownership_epoch').exists() ? ${base}.child('ownership_epoch').val() : 0)`;
  const fields = ['status','version','ownership_version','access_epoch','remaining','reason','updated_at','updated_by'];
  const equal = node => fields.map(key => `newData.child('${key}').val() === ${node}.child('${key}').val()`).join(' && ');
  const propRules = Object.fromEntries(fields.map(key => [key, {'.validate':true}]));
  const current = `${base}.child('bar_deletions').child($bar)`;
  const next = `(${current}.exists() ? ${current}.child('version').val()+1 : 1)`;
  const history = "newData.parent().parent().child('bar_deletion_history').child($bar).child(''+newData.child('version').val())";
  const status = "newData.child('status').val()";
  const queue = "newData.child('remaining').val()";
  const oldQueue = "data.child('remaining').val()";
  const fresh = `data.child('ownership_version').val() === ${state}.child('version').val() && data.child('access_epoch').val() === ${epoch}`;
  const pending = `data.child('status').val() === 'pendente' && (${fresh})`;
  const restart = `!data.exists() || data.child('status').val() === 'recusada' || data.child('status').val() === 'administrativa' || !(${fresh})`;
  const removeActor = source => `${source}.replace('|'+auth.uid+'|','|')`;
  const canWrite = `${active} && ((${owner}) || (${admin})) && ${bar}.exists() && !${bar}.child('deleted_at').exists() && newData.exists()`;
  direct.bar_deletions = {$bar:{
    '.write':canWrite,
    '.validate':[
      `newData.hasChildren(${JSON.stringify(fields)}) && ${equal(history)}`,
      `newData.child('version').val() === ${next} && newData.child('updated_by').val() === auth.uid`,
      `newData.child('ownership_version').val() === ${state}.child('version').val() && newData.child('access_epoch').val() === ${epoch}`,
      `((${admin}) && ${status} === 'administrativa' && ${queue} === '|' || (${owner}) && ((${restart}) && ${status} === 'pendente' && ${queue} !== '|' && ${queue} === ${removeActor(`${state}.child('owner_order').val()`)} || (${pending}) && ${oldQueue}.contains('|'+auth.uid+'|') && newData.child('reason').val() === data.child('reason').val() && (${status} === 'recusada' && ${queue} === ${oldQueue} || ${queue} === ${removeActor(oldQueue)} && (${queue} === '|' ? ${status} === 'aprovada' : ${status} === 'pendente'))))`,
    ].join(' && '),
    ...propRules,reason:{'.validate':'newData.isString() && newData.val().length >= 5 && newData.val().length <= 500'},
    updated_at:{'.validate':'newData.isString() && newData.val().length === 24'},$other:{'.validate':false},
  }};
  const after = "newData.parent().parent().parent().child('bar_deletions').child($bar)";
  direct.bar_deletion_history = {$bar:{$version:{
    '.write':`${canWrite} && !data.exists()`,
    '.validate':`$version === ''+${next} && ${after}.child('version').val() === ${next} && ${equal(after)}`,
    ...propRules,$other:{'.validate':false},
  }}};
  const order = `${state}.child('owner_order').val()`.replaceAll('$bar','$id');
  const authorization = current.replaceAll('$bar','$id');
  const version = `${state}.child('version').val()`.replaceAll('$bar','$id');
  const freshAuthorization = `${authorization}.child('ownership_version').val() === ${version} && ${authorization}.child('access_epoch').val() === ${epoch}`;
  return `((${admin}) ? (${freshAuthorization} && ${authorization}.child('status').val() === 'administrativa' && ${authorization}.child('updated_by').val() === auth.uid) : (${order} === '|'+auth.uid+'|' || (${freshAuthorization} && ${authorization}.child('status').val() === 'aprovada')))`;
};
