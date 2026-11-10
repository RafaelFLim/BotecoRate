// Generate explicit RTDB checks; no permission relies on client-side validation.
const fs = require('node:fs');
const path = require('node:path');
const destination = path.join(__dirname,'../firebase/database.rules.json');
const rules = JSON.parse(fs.readFileSync(destination,'utf8'));
const base = "root.child('v1/direct')";
const active = "auth != null && auth.token.email_verified === true && (!root.child('v1/access_control').child(auth.uid).exists() || root.child('v1/access_control').child(auth.uid).child('status').val() === 'ativo')";
const admin = "root.child('v1/access_control').child(auth.uid).child('role').val() === 'admin'";
const ownerRole = `(${admin} || root.child('v1/access_control').child(auth.uid).child('role').val() === 'dono')`;
const createBar = `(${admin} || (${ownerRole} && root.child('v1/owner_approvals').child(auth.uid).child('status').val() === 'aprovada'))`;
const owns = bar => `(${admin} || (${ownerRole} && root.child('v1/custody').child(${bar}).child('active').val() !== true && ${base}.child('owners').child(${bar}).child(auth.uid).val() === true))`;
const future = 'newData.parent().parent().parent()';
const tableFields = {
  bares:['nome','endereco','cep','cnpj','logradouro','numero','complemento','bairro','cidade','uf','detalhes','foto','latitude','longitude','criado_por','item_a','item_b','item_c'],
  itens_cardapio:['bar_id','tipo','nome','descricao','valor_centavos','foto'],
  avaliacoes_bares:['bar_id','autor_id','autor_nome','nota','comentario','elegivel_ranking'],
  avaliacoes_itens:['item_id','autor_id','autor_nome','nota','comentario','elegivel_ranking'],
};
const common = ['id','version','created_at','updated_at','deleted_at','last_operation'];
const child = (obj,key) => `${obj}.child('${key}')`;
const equalFields = (a,b,fields) => fields.map(k=>`${child(a,k)}.val() === ${child(b,k)}.val()`).join(' && ');
const text = (max,required=false) => `(newData.isString() && newData.val().length <= ${max}${required?' && newData.val().length > 0':''})`;
const direct = {'.read':active,entities:{},history:{},owners:{},public_bars:{},review_index:{},deletion_times:{}};
for (const [table,fields] of Object.entries(tableFields)) {
  const isBar = table==='bares', isItem=table==='itens_cardapio';
  const isReview = !isBar && !isItem;
  const old = `${base}.child('entities/${table}').child($id)`;
  const entity = `${future}.child('entities/${table}').child($id)`;
  const parentKey = table==='avaliacoes_itens'?'item_id':'bar_id';
  const barId = isBar ? '$id' : table==='avaliacoes_itens' ? `${future}.child('entities/itens_cardapio').child(newData.child('item_id').val()).child('bar_id').val()` : "newData.child('bar_id').val()";
  const parentBar = `${future}.child('entities/bares').child(${barId})`;
  const restoring = "(data.child('deleted_at').exists() && !newData.child('deleted_at').exists())";
  const previousVersion = "('' + data.child('version').val())";
  const deletionEvent = `${base}.child('history/${table}').child($id).child(${previousVersion})`;
  const deletionTime = `${base}.child('deletion_times/${table}').child($id).child(${previousVersion})`;
  const restoredParent = (type,id) => {
    const parentOld = `${base}.child('entities/${type}').child(${id})`;
    const parentNew = `${future}.child('entities/${type}').child(${id})`;
    return `(${parentOld}.child('deleted_at').exists() && !${parentNew}.child('deleted_at').exists() && ${parentOld}.child('last_operation').val() === data.child('last_operation').val() && ${parentNew}.child('last_operation').val() === newData.child('last_operation').val())`;
  };
  const reviewActor = `(data.child('autor_id').val() === auth.uid || (${owns(barId)} && (${restoredParent('bares',barId)}${table==='avaliacoes_itens'?` || ${restoredParent('itens_cardapio',"newData.child('item_id').val()")}`:''})))`;
  const restorePermission = `(${restoring} && ${deletionTime}.isNumber() && now < ${deletionTime}.val()+2592000000 && ${deletionEvent}.child('operation').val() === 'soft_delete' && (${admin} || (${deletionEvent}.child('actor_uid').val() === auth.uid && ${isReview?reviewActor:owns(barId)})))`;
  const permitted = isBar ? `((data.exists() && ${owns('$id')}) || (!data.exists() && ${ownerRole}))` : isItem ? `(${owns(barId)} || (${ownerRole} && !${base}.child('entities/bares').child(${barId}).exists() && ${parentBar}.child('criado_por').val() === auth.uid))` : `(newData.child('autor_id').val() === auth.uid || (data.exists() && newData.child('deleted_at').exists() && ${owns(barId)} && (${parentBar}.child('deleted_at').exists()${table==='avaliacoes_itens'?` || ${future}.child('entities/itens_cardapio').child(newData.child('item_id').val()).child('deleted_at').exists()`:''})))`;
  const required = common.filter(k=>k!=='deleted_at').concat(isBar?['nome','endereco','detalhes','foto','criado_por']:isItem?['bar_id','tipo','nome','descricao','valor_centavos']: [parentKey,'autor_nome','nota','comentario','elegivel_ranking']);
  const checks = [
    `newData.hasChildren(${JSON.stringify(required)})`,
    "newData.child('id').val() === $id",
    "newData.child('version').val() === (data.exists() ? data.child('version').val() + 1 : 1)",
    "(!data.exists() || newData.child('created_at').val() === data.child('created_at').val())",
    `${future}.child('history/${table}').child($id).child('' + newData.child('version').val()).child('operation_id').val() === newData.child('last_operation').val()`,
  ];
  if (!isBar) checks.push(`(!data.exists() || newData.child('${parentKey}').val() === data.child('${parentKey}').val())`,`${parentBar}.exists()`, `(newData.child('deleted_at').exists() || !${parentBar}.child('deleted_at').exists())`);
  if (isBar) {
    const addressParts=['logradouro','numero','complemento','bairro','cidade','uf'];
    checks.push(`(!(${addressParts.map(field=>`newData.child('${field}').exists()`).join(' || ')}) || (${['logradouro','numero','cidade','uf'].map(field=>`newData.child('${field}').isString() && newData.child('${field}').val().matches(/.*[^ ].*/)`).join(' && ')}))`);
    checks.push("(data.exists() ? newData.child('criado_por').val() === data.child('criado_por').val() : newData.child('criado_por').val() === auth.uid)",
      `(data.exists() || ${future}.child('owners').child($id).child(newData.child('criado_por').val()).val() === true)`,
      `(newData.child('latitude').exists() === newData.child('longitude').exists())`);
    const anchors = ['item_a','item_b','item_c'];
    checks.push(`(newData.child('deleted_at').exists() || (${anchors.map(k=>`${future}.child('entities/itens_cardapio').child(newData.child('${k}').val()).child('bar_id').val() === $id && !${future}.child('entities/itens_cardapio').child(newData.child('${k}').val()).child('deleted_at').exists()`).join(' && ')} && newData.child('item_a').val() !== newData.child('item_b').val() && newData.child('item_a').val() !== newData.child('item_c').val() && newData.child('item_b').val() !== newData.child('item_c').val()))`);
    checks.push(`${future}.child('public_bars').child($id).child('version').val() === newData.child('version').val()`);
  }
  if (isItem) {
    checks.push(`(!newData.child('deleted_at').exists() || ${parentBar}.child('deleted_at').exists() || (${['item_a','item_b','item_c'].map(k=>`${parentBar}.child('${k}').val() !== $id`).join(' && ')}))`);
  }
  if (isReview) {
    const index = `${future}.child('review_index/${table}').child(newData.child('${parentKey}').val()).child(auth.uid)`;
    const restoreIndex = `${future}.child('review_index/${table}').child(newData.child('${parentKey}').val()).child(newData.child('autor_id').val())`;
    checks.push(`(data.exists() ? newData.child('autor_id').val() === data.child('autor_id').val() && newData.child('autor_nome').val() === data.child('autor_nome').val() && newData.child('elegivel_ranking').val() === data.child('elegivel_ranking').val() : newData.child('autor_id').val() === auth.uid && newData.child('elegivel_ranking').val() === 1)`,
      `(newData.child('deleted_at').exists() || (${restoring} ? newData.child('autor_id').exists() && ${restoreIndex}.val() === $id : (${future}.child('owners').child(${barId}).child(auth.uid).val() !== true && ${index}.val() === $id)))`);
    if (table==='avaliacoes_itens') checks.push(`${future}.child('entities/itens_cardapio').child(newData.child('item_id').val()).exists()`,`(newData.child('deleted_at').exists() || !${future}.child('entities/itens_cardapio').child(newData.child('item_id').val()).child('deleted_at').exists())`);
  }
  // Soft delete cannot silently rewrite the deleted content.
  checks.push(`((!newData.child('deleted_at').exists() && !${restoring}) || (data.exists() && ${equalFields('newData','data',fields.filter(k=>!k.startsWith('item_')))}))`);
  const nextDeletionTime = `${future}.child('deletion_times/${table}').child($id).child(''+newData.child('version').val())`;
  checks.push(`(!newData.child('deleted_at').exists() || ${nextDeletionTime}.val() === now)`);
  const rowRules = {'.write':`${active} && newData.exists() && (( !data.child('deleted_at').exists() && ${permitted}${isBar ? ` && (data.exists() || ${createBar})` : ''}) || ${restorePermission})`,'.validate':checks.join(' && ')};
  for (const k of [...common,...fields]) {
    let validate = text(128,true);
    if (['nome','autor_nome'].includes(k)) validate=text(150,true);
    if (k==='endereco') validate=text(500,true);
    if (['logradouro','complemento','bairro','cidade'].includes(k)) validate=text(k==='logradouro'?150:100);
    if (k==='numero') validate=text(20,true);
    if (k==='uf') validate="newData.isString() && newData.val().matches(/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/)";
    if (k==='cep') validate="newData.isString() && newData.val().matches(/^[0-9]{8}$/)";
    if (k==='cnpj') validate="newData.isString() && newData.val().matches(/^[A-Z0-9]{12}[0-9]{2}$/)";
    if (['detalhes','descricao','comentario'].includes(k)) validate=text(5000);
    if (k==='foto') validate=`newData.isString() && ((newData.val().length <= 2048 && newData.val().beginsWith('https://')) || (newData.val().length <= ${require('../src/constants/photoLimits.cjs').maxDataUriLength} && (newData.val().length - 23) % 4 === 0 && newData.val().matches(/^data:image\\/jpeg;base64,\\/9j\\/[A-Za-z0-9+\\/]*={0,2}$/)))`;
    if (k==='version') validate='newData.isNumber() && newData.val() >= 1 && newData.val() % 1 === 0';
    if (k==='latitude') validate='newData.isNumber() && newData.val() >= -90 && newData.val() <= 90';
    if (k==='longitude') validate='newData.isNumber() && newData.val() >= -180 && newData.val() <= 180';
    if (k==='tipo') validate="newData.val() === 'comida' || newData.val() === 'bebida'";
    if (k==='valor_centavos') validate='newData.isNumber() && newData.val() > 0 && newData.val() <= 100000000 && newData.val() % 1 === 0';
    if (k==='nota') validate='newData.isNumber() && newData.val() >= 1 && newData.val() <= 5 && newData.val() % 1 === 0';
    if (k==='elegivel_ranking') validate='newData.val() === 0 || newData.val() === 1';
    rowRules[k]={'.validate':validate};
  }
  rowRules.$other={'.validate':false};
  direct.entities[table]={$id:rowRules};
  // Append-only audit, validated against both the previous and the final state.
  const newRoot='newData.parent().parent().parent().parent()';
  const after=`${newRoot}.child('entities/${table}').child($id)`;
  const all=[...common,...fields];
  const entry={'.write':`${active} && !data.exists() && newData.exists()`,'.validate':`newData.hasChildren(['actor_uid','operation_id','operation','before','record']) && newData.child('actor_uid').val() === auth.uid && ${after}.child('version').val() === (${old}.exists() ? ${old}.child('version').val() + 1 : 1) && $version === '' + ${after}.child('version').val() && newData.child('operation_id').val() === ${after}.child('last_operation').val() && (${old}.exists() ? (!newData.child('before/absent').exists() && (${equalFields("newData.child('before')",old,all)})) : newData.child('before/absent').val() === true) && ${equalFields("newData.child('record')",after,all)} && (${old}.exists() ? (newData.child('operation').val() === (${after}.child('deleted_at').exists() ? 'soft_delete' : 'update')) : newData.child('operation').val() === 'create')`};
  entry['.validate'] = entry['.validate'].replace(" : 'update'))", ` : (${old}.child('deleted_at').exists() ? 'restore' : 'update')))`);
  direct.deletion_times[table]={$id:{$version:{
    '.write':`${active} && !data.exists() && newData.isNumber() && newData.val() === now`,
    '.validate':`! ${old}.child('deleted_at').exists() && ${old}.exists() && ${after}.child('deleted_at').exists() && ${after}.child('version').val() === ${old}.child('version').val()+1 && $version === ''+${after}.child('version').val()`,
  }}};
  for(const name of ['before','record']) {
    entry[name]={};
    for(const k of [...all,'absent']) entry[name][k]={'.validate':true};
    entry[name].$other={'.validate':false};
  }
  for(const k of ['actor_uid','operation_id','operation']) entry[k]={'.validate':text(128,true)};
  entry.command_hash={'.validate':'newData.isString() && newData.val().length === 64'};
  entry['.validate']="newData.hasChild('command_hash') && " + entry['.validate'];
  entry.$other={'.validate':false};
  direct.history[table]={$id:{$version:entry}};
  if (isReview) {
    const r="newData.parent().parent().parent().parent().child('entities/"+table+"').child(newData.val())";
    const previous="newData.parent().parent().parent().parent().child('entities/"+table+"').child(data.val())";
    direct.review_index[table]={$target:{$uid:{'.write':`${active} && auth.uid === $uid && newData.isString() && (!data.exists() || newData.val() === data.val() || ${previous}.child('deleted_at').exists())`,'.validate':`${r}.child('autor_id').val() === $uid && ${r}.child('${parentKey}').val() === $target && !${r}.child('deleted_at').exists()`}}};
  }
}
direct.owners={$bar:{$uid:{'.write':`${active} && ${ownerRole} && auth.uid === $uid && !data.exists() && !${base}.child('entities/bares').child($bar).exists() && newData.val() === true`,'.validate':"newData.parent().parent().parent().child('entities/bares').child($bar).child('criado_por').val() === $uid"}}};
const publicFuture="newData.parent().parent().child('entities/bares').child($bar)";
direct.public_bars={'.read':true,$bar:{'.write':`${active} && newData.exists() && (${owns('$bar')} || (!${base}.child('entities/bares').child($bar).exists() && ${ownerRole}))`,'.validate':`newData.hasChildren(['id','nome','endereco','foto','version']) && ${equalFields('newData',publicFuture,['id','nome','endereco','foto','latitude','longitude','deleted_at','version'])}`}};
for (const k of ['id','nome','endereco','foto','latitude','longitude','deleted_at','version']) direct.public_bars.$bar[k]={'.validate':true};
direct.public_bars.$bar.$other={'.validate':false};
rules.rules.v1.direct=direct;
require('./admin-rules.cjs')(rules.rules.v1,active,admin);
require('./ownership-rules.cjs').build(rules.rules.v1,active,admin);
require('./profile-rules.cjs')(rules.rules.v1);
require('./custody-rules.cjs')(rules.rules.v1,active,admin);
require('./owner-approval-rules.cjs')(rules.rules.v1,active,admin);
require('./cnpj-rules.cjs')(rules.rules.v1,active,admin);
const mayDeleteBar = require('./bar-deletion-rules.cjs')(direct,active,admin);
direct.entities.bares.$id['.write'] += ` && (!newData.child('deleted_at').exists() || ${mayDeleteBar})`;
fs.writeFileSync(destination,JSON.stringify(rules,null,2)+'\n');
