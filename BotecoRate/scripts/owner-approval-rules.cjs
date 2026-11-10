module.exports = function addOwnerApprovalRules(v1, active, admin) {
  const allowed = `(${active}) && (${admin})`;
  const own = `(${active}) && auth.uid === $uid`;
  const fields = ['cnpj','business','status','version','updated_by','updated_at','reason'];
  const old = "root.child('v1/owner_approvals').child($uid)";
  const nextVersion = `(${old}.exists() ? ${old}.child('version').val()+1 : 1)`;
  const equal = node => fields.map(field => `newData.child('${field}').val() === ${node}.child('${field}').val()`).join(' && ');
  const parent = 'newData.parent().parent()';
  const history = `${parent}.child('owner_approval_history').child($uid).child(''+newData.child('version').val())`;
  const status = "newData.child('status').val()";
  const before = `${old}.child('status').val()`;
  const target = `${parent}.child('access_control').child($uid)`;
  const decision = `${allowed} && auth.uid !== $uid && newData.child('cnpj').val() === ${old}.child('cnpj').val() && newData.child('business').val() === ${old}.child('business').val()`;
  const field = Object.fromEntries(fields.map(key => [key, {'.validate':true}]));
  v1.owner_approvals = {'.read':allowed,$uid:{
    '.read':own,
    '.write':`((${own}) || (${allowed})) && newData.exists()`,
    '.validate':`newData.hasChildren(${JSON.stringify(fields)}) && newData.child('version').val() === ${nextVersion} && newData.child('updated_by').val() === auth.uid && ${equal(history)} && ((${own} && ${status} === 'pendente' && (!${old}.exists() || ${before} === 'recusada' || ${before} === 'revogada')) || (${decision} && ((${before} === 'pendente' && (${status} === 'recusada' || (${status} === 'aprovada' && ${target}.child('role').val() === 'dono' && ${target}.child('status').val() === 'ativo' && root.child('v1/user_directory').child($uid).child('email_verified').val() === true))) || (${before} === 'aprovada' && ${status} === 'revogada'))))`,
    ...field,
    cnpj:{'.validate':"newData.isString() && newData.val().matches(/^[A-Z0-9]{12}[0-9]{2}$/)"},
    business:{'.validate':'newData.isString() && newData.val().length >= 2 && newData.val().length <= 150'},
    reason:{'.validate':'newData.isString() && newData.val().length >= 5 && newData.val().length <= 500'},
    updated_at:{'.validate':'newData.isString() && newData.val().length === 24'},
    $other:{'.validate':false},
  }};
  const current = "newData.parent().parent().parent().child('owner_approvals').child($uid)";
  v1.owner_approval_history = {'.read':allowed,$uid:{'.read':own,$version:{
    '.write':`((${own}) || (${allowed})) && !data.exists() && newData.exists()`,
    '.validate':`$version === ''+${nextVersion} && ${current}.child('version').val() === ${nextVersion} && ${equal(current)}`,
    ...field,$other:{'.validate':false},
  }}};
};
