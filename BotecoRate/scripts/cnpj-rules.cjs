module.exports = function addCnpjRules(v1, active, admin) {
  const direct = v1.direct;
  const initial = uid => `root.child('v1/owner_approvals').child(${uid})`;
  const primary = initial('auth.uid');
  const oldPrimaryCnpj = "data.child('cnpj').val()";
  v1.owner_approvals.$uid['.validate'] += ` && (!data.exists() || newData.child('cnpj').val() === ${oldPrimaryCnpj} || !root.child('v1/direct/cnpj_usage').child($uid).child(${oldPrimaryCnpj}).exists())`;
  const cnpj = "newData.child('cnpj').val()";
  const usage = "root.child('v1/direct/cnpj_usage').child(auth.uid)";
  const future = 'newData.parent().parent().parent()';
  const extra = `root.child('v1/owner_cnpjs').child(auth.uid).child(${cnpj})`;
  direct.entities.bares.$id['.validate'] += ` && (data.exists() ? ${cnpj} === data.child('cnpj').val() : ((${admin}) && !newData.child('cnpj').exists() || newData.child('cnpj').isString() && !${usage}.child(${cnpj}).exists() && ${future}.child('cnpj_usage').child(auth.uid).child(${cnpj}).val() === $id && (${usage}.child(${primary}.child('cnpj').val()).exists() ? ${extra}.child('status').val() === 'aprovada' : ${cnpj} === ${primary}.child('cnpj').val())))`;
  const bar = "newData.parent().parent().parent().child('entities/bares').child(newData.val())";
  direct.cnpj_usage = {$uid:{$cnpj:{
    '.write':`(${active}) && auth.uid === $uid && !data.exists() && newData.isString()`,
    '.validate':`$cnpj.matches(/^[A-Z0-9]{12}[0-9]{2}$/) && !root.child('v1/direct/entities/bares').child(newData.val()).exists() && ${bar}.child('cnpj').val() === $cnpj && ${bar}.child('criado_por').val() === $uid`,
  }}};

  const allowed = `(${active}) && (${admin})`;
  const own = `(${active}) && auth.uid === $uid`;
  const eligible = `${initial('$uid')}.child('status').val() === 'aprovada' && root.child('v1/access_control').child($uid).child('role').val() === 'dono' && root.child('v1/access_control').child($uid).child('status').val() === 'ativo'`;
  const fields = ['status','version','updated_by','updated_at','reason'];
  const old = "root.child('v1/owner_cnpjs').child($uid).child($cnpj)";
  const version = `(${old}.exists() ? ${old}.child('version').val()+1 : 1)`;
  const history = "newData.parent().parent().parent().child('owner_cnpj_history').child($uid).child($cnpj).child(''+newData.child('version').val())";
  const equal = node => fields.map(key=>`newData.child('${key}').val() === ${node}.child('${key}').val()`).join(' && ');
  const shapes = {
    status:{'.validate':true},version:{'.validate':true},updated_by:{'.validate':true},
    updated_at:{'.validate':'newData.isString() && newData.val().length === 24'},
    reason:{'.validate':'newData.isString() && newData.val().length >= 5 && newData.val().length <= 500'},$other:{'.validate':false},
  };
  const status = "newData.child('status').val()";
  const permission = `((${own}) || (${allowed})) && newData.exists()`;
  v1.owner_cnpjs = {'.read':allowed,$uid:{'.read':own,$cnpj:{
    '.write':permission,
    '.validate':`$cnpj.matches(/^[A-Z0-9]{12}[0-9]{2}$/) && $cnpj !== ${initial('$uid')}.child('cnpj').val() && newData.hasChildren(${JSON.stringify(fields)}) && newData.child('updated_by').val() === auth.uid && newData.child('version').val() === ${version} && ${equal(history)} && ((${own} && ${eligible} && ${status} === 'pendente' && (!data.exists() || data.child('status').val() === 'recusada') && !root.child('v1/direct/cnpj_usage').child($uid).child($cnpj).exists()) || (${allowed} && auth.uid !== $uid && data.child('status').val() === 'pendente' && (${status} === 'recusada' || (${eligible} && ${status} === 'aprovada'))))`,
    ...shapes,
  }}};
  const current = "newData.parent().parent().parent().parent().child('owner_cnpjs').child($uid).child($cnpj)";
  v1.owner_cnpj_history = {'.read':allowed,$uid:{'.read':own,$cnpj:{$version:{
    '.write':`${permission} && !data.exists()`,
    '.validate':`$version === ''+${version} && ${current}.child('version').val() === ${version} && ${equal(current)}`,
    ...shapes,
  }}}};
};
