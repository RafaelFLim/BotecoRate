const policy = require('../src/constants/usernamePolicy.cjs');
const quote = value => JSON.stringify(value);
const accented = policy.folds.map(([letters]) => letters + letters.toUpperCase()).join('');
function key(value) {
  let expression = `${value}.toLowerCase()`;
  for (const [letters, replacement] of policy.folds) for (const letter of letters) expression += `.replace(${quote(letter)},${quote(replacement)})`;
  for (const char of [' ', '.', '_', '-', "'"]) expression += `.replace(${quote(char)},'')`;
  for (const char of ['\u0300','\u0301','\u0302','\u0303','\u0308','\u030a','\u0327']) expression += `.replace(${quote(char)},'')`;
  return expression;
}
function valid(value) {
  return `${value}.length <= ${policy.maxLength} && ${value}.matches(/^[A-Za-z${accented}0-9 ._'\\-]+$/) && ${key(value)}.matches(/.*[a-z].*[a-z].*[a-z].*/)`;
}
module.exports = function buildProfileRules(v1) {
  const own = "auth != null && auth.uid === $uid && (!root.child('v1/access_control').child(auth.uid).exists() || root.child('v1/access_control').child(auth.uid).child('status').val() === 'ativo')";
  const future = 'newData.parent().parent()';
  const name = "newData.child('name').val()";
  const oldProfile = "root.child('v1/public_profiles').child($uid)";
  const oldDirectory = "root.child('v1/user_directory').child($uid)";
  const profile = `${future}.child('public_profiles').child($uid)`;
  const directory = `${future}.child('user_directory').child($uid)`;
  v1.public_profiles = {$uid:{'.read':'auth != null && auth.uid === $uid',
    '.write':`${own} && auth.token.email_verified === true && newData.exists()`,
    '.validate':`newData.hasChildren(['name','version','updated_at']) && newData.child('version').val() === (data.exists() ? data.child('version').val()+1 : 1) && ${future}.child('profile_history').child($uid).child(''+newData.child('version').val()).exists() && ${valid(name)} && ${future}.child('username_index').child(${key(name)}).val() === $uid && ${directory}.child('name').val() === ${name} && ${key(name)} !== ${key(`(${oldProfile}.exists() ? ${oldProfile}.child('name').val() : ${oldDirectory}.child('name').val())`)}`,
    name:{'.validate':'newData.isString()'},version:{'.validate':'newData.isNumber() && newData.val() % 1 === 0'},updated_at:{'.validate':'newData.isString()'},$other:{'.validate':false}}};
  const previousName = `(${oldProfile}.exists() ? ${oldProfile}.child('name').val() : ${oldDirectory}.child('name').val())`;
  v1.public_profiles.$uid['.validate'] += ` && (${key(previousName)}.length === 0 || ${future}.child('username_index').child(${key(previousName)}).val() !== $uid)`;
  const historyFuture = 'newData.parent().parent().parent()';
  v1.profile_history = {$uid:{'.read':'auth != null && auth.uid === $uid',$version:{
    '.write':`${own} && auth.token.email_verified === true && !data.exists() && newData.exists()`,
    '.validate':`newData.hasChildren(['name','date']) && $version === ''+${historyFuture}.child('public_profiles').child($uid).child('version').val() && newData.child('name').val() === (${oldProfile}.exists() ? ${oldProfile}.child('name').val() : ${oldDirectory}.child('name').val()) && newData.child('date').val() === ${historyFuture}.child('public_profiles').child($uid).child('updated_at').val()`,
    name:{'.validate':'newData.isString()'},date:{'.validate':'newData.isString()'},$other:{'.validate':false}}}};
  const dir = v1.user_directory.$uid;
  dir['.validate'] += ` && ((data.exists() && ${name} === data.child('name').val()) || (${valid(name)} && ${future}.child('username_index').child(${key(name)}).val() === $uid && (!data.exists() || (${profile}.child('name').val() === ${name} && ${profile}.child('version').val() === (${oldProfile}.exists() ? ${oldProfile}.child('version').val()+1 : 1)))))`;
  v1.ownership_accounts.$uid.name['.validate'] += ` && (newData.val() === data.val() || newData.val() === newData.parent().parent().parent().child('user_directory').child($uid).child('name').val())`;
  const indexFuture = 'newData.parent().parent()';
  const targetName = `${indexFuture}.child('user_directory').child(auth.uid).child('name').val()`;
  const active = "auth != null && (!root.child('v1/access_control').child(auth.uid).exists() || root.child('v1/access_control').child(auth.uid).child('status').val() === 'ativo')";
  const adminRead = `${active} && auth.token.email_verified === true && root.child('v1/access_control').child(auth.uid).child('role').val() === 'admin'`;
  v1.public_profiles['.read'] = adminRead;
  v1.profile_history['.read'] = adminRead;
  // Leitura de uma chave exata para disponibilidade, nunca listagem do índice.
  v1.username_index = {$key:{'.read':true,
    '.write':`${active} && (newData.exists() ? ((!data.exists() || data.val() === auth.uid) && newData.val() === auth.uid && $key === ${key(targetName)} && ${valid(targetName)}) : (data.val() === auth.uid && $key !== ${key(targetName)} && ${indexFuture}.child('username_index').child(${key(targetName)}).val() === auth.uid))`,
    '.validate':'newData.isString() && newData.val().length > 0 && newData.val().length <= 128'}};
};
