module.exports = function addCustodyRules(v1, active, admin) {
  const allowed = `(${active}) && (${admin})`;
  const fields = ['active', 'version', 'updated_at', 'updated_by', 'reason', 'access_epoch', 'ownership_version'];
  const old = "root.child('v1/custody').child($bar)";
  const nextVersion = `(${old}.exists() ? ${old}.child('version').val() + 1 : 1)`;
  const equal = node => fields.map(field => `newData.child('${field}').val() === ${node}.child('${field}').val()`).join(' && ');
  const future = 'newData.parent().parent()';
  const epoch = node => `(${node}.exists() ? ${node}.val() : 0)`;
  const history = `${future}.child('custody_history').child($bar).child('' + newData.child('version').val())`;
  v1.custody = {'.read':allowed,$bar: {
    '.write': `${allowed} && newData.exists()`,
    '.validate': [
      `newData.hasChildren(${JSON.stringify(fields)})`,
      `newData.child('version').val() === ${nextVersion}`,
      "newData.child('updated_by').val() === auth.uid",
      `newData.child('active').val() !== (${old}.exists() ? ${old}.child('active').val() : false)`,
      `${future}.child('direct/entities/bares').child($bar).exists() && !${future}.child('direct/entities/bares').child($bar).child('deleted_at').exists()`,
      `newData.child('access_epoch').val() === ${epoch(`${future}.child('direct/ownership_epoch')`)}`,
      `newData.child('ownership_version').val() === ${epoch(`${future}.child('direct/ownership_state').child($bar).child('version')`)}`,
      equal(history),
    ].join(' && '),
    active: {'.validate':'newData.isBoolean()'},
    updated_at: {'.validate':'newData.isString() && newData.val().length === 24'},
    reason: {'.validate':'newData.isString() && newData.val().length >= 5 && newData.val().length <= 500'},
    ...Object.fromEntries(['version','updated_by','access_epoch','ownership_version'].map(field => [field, {'.validate':true}])),
    $other: {'.validate':false},
  }};
  const current = "newData.parent().parent().parent().child('custody').child($bar)";
  v1.custody_history = {'.read':allowed,$bar: {$version: {
    '.write': `${allowed} && !data.exists() && newData.exists()`,
    '.validate': `$version === '' + ${nextVersion} && ${current}.child('version').val() === ${nextVersion} && ${equal(current)}`,
    ...Object.fromEntries(fields.map(field => [field, {'.validate':true}])),
    $other: {'.validate':false},
  }}};
};
