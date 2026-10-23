import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {SCHEMA_SQL} from '../src/database/schema.js';
import {readCatalog,storeCatalog} from '../src/database/catalogStore.js';
import {saveOwnership} from '../src/database/ownershipStore.js';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {get,ref,set,update} from 'firebase/database';
import {createOwnershipRequest,actOnOwnershipRequest,ownershipRoleGrant} from '../src/services/ownershipProtocol.js';
import {planDirectCommand} from '../src/services/directProtocol.js';
import {planAccessChange} from '../src/services/adminProtocol.js';
const now=()=>new Date().toISOString();
const enabled=Boolean(process.env.FIREBASE_DATABASE_EMULATOR_HOST),options={skip:!enabled};let env;
before(async()=>{if(enabled)env=await initializeTestEnvironment({projectId:'demo-ownership-tests',database:{rules:readFileSync(new URL('../firebase/database.rules.json',import.meta.url),'utf8')}});});
after(async()=>{if(env)await env.cleanup();});
const account=(uid,verified=true)=>env.authenticatedContext(uid,{email_verified:verified,email:`${uid}@example.test`}).database();
async function reset() {
  await env.clearDatabase();
  const access={a:{role:'dono',status:'ativo'},b:{role:'dono',status:'ativo'},admin:{role:'admin',status:'ativo'},banned:{role:'dono',status:'banido'}};
  const cards=Object.fromEntries(['a','b','c','d','admin','banned'].map(uid=>[uid,{uid,name:uid,email_verified:true,updated_at:now(),access:{role:access[uid]?.role||'comum',status:access[uid]?.status||'ativo',version:0,initialized:Boolean(access[uid])}}]));
  await env.withSecurityRulesDisabled(ctx=>set(ref(ctx.database(),'v1'),{access_control:access,ownership_accounts:cards,user_directory:Object.fromEntries(Object.keys(cards).map(uid=>[uid,{uid,email_verified:true}])),direct:{
    entities:{bares:{bar:{id:'bar',nome:'Bar',endereco:'Rua',detalhes:'Descrição',foto:'https://example.test/p.jpg',criado_por:'a',item_a:'i1',item_b:'i2',item_c:'i3',version:1,created_at:now(),updated_at:now(),last_operation:'seed'}},itens_cardapio:Object.fromEntries([1,2,3].map(n=>['i'+n,{id:'i'+n,bar_id:'bar',tipo:'comida',nome:'Item',descricao:'Porção',valor_centavos:100,version:1,created_at:now(),updated_at:now(),last_operation:'seed'}]))},
    owners:{bar:{a:true,b:true}},ownership_state:{bar:{version:0,owner_order:'|a|b|',updated_at:now(),updated_by:'a'}}}}));
}
const state=async(db=account('a'))=>(await get(ref(db,'v1/direct'))).val();
async function create(id='request',replaceUid=null,recipient='c') {
  const updates=createOwnershipRequest(await state(),{barId:'bar',id,recipient,replaceUid,actor:'a',reason:'Entrada de novo sócio',now:now()});
  await assertSucceeds(update(ref(account('a'),'v1'),updates));
  return (await state()).ownership_requests.bar[id];
}
async function act(actor,action='aceitar',id='request') {
  const db=account(actor),s=await state(db),request=s.ownership_requests.bar[id];
  let updates=actOnOwnershipRequest(s,request,{actor,action,now:now()});
  const access=(await get(ref(db,`v1/ownership_accounts/${request.recipient_uid}/access`))).val();
  updates=ownershipRoleGrant(updates,access,actor,now());
  await assertSucceeds(update(ref(db,'v1'),updates));
  return (await state(db)).ownership_requests.bar[id];
}
function apply(state,updates) {
  const copy=structuredClone(state);
  for(const [path,v] of Object.entries(updates)){let obj=copy;const parts=path.replace(/^direct\//,'').split('/');for(const k of parts.slice(0,-1))obj=obj[k]??={};if(v===null)delete obj[parts.at(-1)];else obj[parts.at(-1)]=structuredClone(v);}
  return copy;
}
test('protocolo: aceita fora de ordem, preserva demais donos e só conclui após todos assinarem',()=>{
  let s={entities:{bares:{bar:{id:'bar'}}},owners:{bar:{a:true,b:true}},ownership_state:{bar:{version:0,owner_order:'|a|b|'}}};
  s=apply(s,createOwnershipRequest(s,{barId:'bar',id:'r',recipient:'c',replaceUid:'a',actor:'b',reason:'Mudança societária',now:now()}));
  for(const actor of ['c','b','a']){const r=s.ownership_requests.bar.r;s=apply(s,actOnOwnershipRequest(s,r,{actor,action:'aceitar',now:now()}));}
  assert.deepEqual(s.owners.bar,{a:true,b:true});
  s=apply(s,actOnOwnershipRequest(s,s.ownership_requests.bar.r,{actor:'a',action:'processar',now:now()}));
  s=apply(s,actOnOwnershipRequest(s,s.ownership_requests.bar.r,{actor:'a',action:'processar',now:now()}));
  assert.deepEqual(s.owners.bar,{b:true,c:true});assert.equal(s.ownership_requests.bar.r.status,'concluida');
  assert.equal(s.entities.bares.bar.id,'bar');
});
test('Firebase: convites fora de ordem concluem unanimidade e promovem comum sem acesso administrativo',options,async()=>{
  await reset();await create();await act('c');await act('b');
  assert.equal((await state()).owners.bar.c,undefined);
  await act('a');await act('a','processar');const done=await act('b','processar');
  assert.equal(done.status,'concluida');assert.equal((await state()).owners.bar.c,true);
  const access=(await get(ref(account('c'),'v1/access_control/c'))).val();assert.equal(access.role,'dono');
  await assertFails(get(ref(account('c'),'v1/user_directory')));
  const audit=(await get(ref(account('admin'),'v1/access_history/c/1'))).val();assert.equal(audit.record.role,'dono');
});
test('Firebase: substitui somente escolhido, preserva criador e nega futuras alterações ao dono removido',options,async()=>{
  await reset();await create('request','a');await act('a');await act('b');await act('c');
  const s=await state();assert.deepEqual(s.owners.bar,{b:true,c:true});assert.equal(s.entities.bares.bar.criado_por,'a');
  const command={protocol:1,operation_id:'edit-after-transfer',changes:[{entity_type:'bares',entity_id:'bar',base_version:1,operation:'update',payload:{...s.entities.bares.bar,nome:'Novo nome'}}]};
  await assertFails(update(ref(account('a'),'v1/direct'),planDirectCommand(s,command,'a','Antigo').updates));
  await assertSucceeds(update(ref(account('b'),'v1/direct'),planDirectCommand(s,command,'b','Dono').updates));
});
test('Firebase: não permite pular assinaturas, forjar voto, apagar aceite ou alterar termos',options,async()=>{
  await reset();await create();const s=await state(),r=s.ownership_requests.bar.request;
  const updates=actOnOwnershipRequest(s,r,{actor:'a',action:'aceitar',now:now()});
  let forged=structuredClone(updates);forged['direct/ownership_requests/bar/request/queue']='|';forged['direct/ownership_requests/bar/request/status']='concluida';
  Object.assign(forged['direct/ownership_history/bar/request/2'].record,{queue:'|',status:'concluida'});
  forged['direct/owners/bar/c']=true;
  forged['direct/ownership_state/bar']={version:1,owner_order:'|a|b|c|',last_request:'request',updated_at:forged['direct/ownership_requests/bar/request/updated_at'],updated_by:'a'};
  forged=ownershipRoleGrant(forged,(await get(ref(account('a'),'v1/ownership_accounts/c/access'))).val(),'a',now());
  await assertFails(update(ref(account('a'),'v1'),forged));
  const terms=structuredClone(updates);terms['direct/ownership_requests/bar/request/reason']='Termos alterados';terms['direct/ownership_history/bar/request/2'].record.reason='Termos alterados';
  await assertFails(update(ref(account('a'),'v1'),terms));
  await assertFails(update(ref(account('b'),'v1'),updates));
  await assertSucceeds(update(ref(account('a'),'v1'),updates));
  await assertFails(set(ref(account('a'),'v1/direct/ownership_requests/bar/request/participants/a'),null));
  await assertFails(set(ref(account('a'),'v1/direct/ownership_history/bar/request/2'),null));
  await assertFails(set(ref(account('admin'),'v1/direct/owners/bar/d'),true));
  await assertFails(update(ref(account('c',false),'v1'),actOnOwnershipRequest(await state(),(await state()).ownership_requests.bar.request,{actor:'c',action:'aceitar',now:now()})));
});
test('Firebase: promoção consensual preserva auditoria de acesso sem expor motivos privados aos donos',options,async()=>{
  await reset();
  await env.withSecurityRulesDisabled(ctx=>update(ref(ctx.database(),'v1'),{
    'access_control/c':{role:'comum',status:'ativo',version:2,reason:'Informação administrativa privada',updated_at:now()},
    'ownership_accounts/c/access':{role:'comum',status:'ativo',version:2,initialized:true},
  }));
  await assertFails(get(ref(account('a'),'v1/access_control/c')));
  await create();await act('a');await act('b');await act('c');
  const history=(await get(ref(account('admin'),'v1/access_history/c/3'))).val();
  assert.equal(history.before.redacted,true);assert.equal(history.before.role,'comum');assert.equal(history.before.version,2);assert.equal(history.before.reason,undefined);
});
test('Firebase: solicitações concorrentes não reutilizam aceites após mudar os donos',options,async()=>{
  await reset();await create('first');await create('second',null,'d');
  const before=await state(),oldWire=actOnOwnershipRequest(before,before.ownership_requests.bar.second,{actor:'a',action:'aceitar',now:now()});
  await act('a','aceitar','first');await act('b','aceitar','first');await act('c','aceitar','first');
  await assertFails(update(ref(account('a'),'v1'),oldWire));
  const s=await state(),stale=s.ownership_requests.bar.second;
  assert.throws(()=>actOnOwnershipRequest(s,stale,{actor:'a',action:'aceitar',now:now()}),/nova solicitação/);
  assert.equal((await act('a','invalidar','second')).status,'invalidada');
  assert.deepEqual((await state()).owners.bar,{a:true,b:true,c:true});
});
test('Firebase: recusa encerra solicitação e cancelamento não troca donos',options,async()=>{
  await reset();await create();assert.equal((await act('c','recusar')).status,'recusada');
  assert.throws(()=>actOnOwnershipRequest({}, {status:'recusada'},{actor:'a',action:'aceitar',now:now()}),/encerrada/);
  await create('cancel');assert.equal((await act('a','cancelar','cancel')).status,'cancelada');
  assert.deepEqual((await state()).owners.bar,{a:true,b:true});
});
test('Firebase: mudança de acesso invalida aceites antigos antes de transferir',options,async()=>{
  await reset();await create();await act('a');
  const before=await state(),oldWire=actOnOwnershipRequest(before,before.ownership_requests.bar.request,{actor:'c',action:'aceitar',now:now()});
  const old=(await get(ref(account('admin'),'v1/access_control/b'))).val();
  await assertSucceeds(update(ref(account('admin'),'v1'),planAccessChange(old,{uid:'b',actor:'admin',action:'banir',reason:'Suspensão de teste',operationId:'ban',now:now(),accessEpoch:0})));
  await assertFails(update(ref(account('c'),'v1'),oldWire));
  const s=await state();assert.throws(()=>actOnOwnershipRequest(s,s.ownership_requests.bar.request,{actor:'c',action:'aceitar',now:now()}),/nova solicitação/);
  assert.equal((await act('a','invalidar')).status,'invalidada');
});

test('SQLite: histórico legível, exclusão permanente do ranking e gravação não reescreve opinião',async()=>{
  const sql=new DatabaseSync(':memory:');sql.exec(SCHEMA_SQL);
  const db={getAllAsync:async(q,...p)=>sql.prepare(q).all(...p),getFirstAsync:async(q,...p)=>sql.prepare(q).get(...p),runAsync:async(q,...p)=>sql.prepare(q).run(...p)};
  await db.runAsync("INSERT INTO usuarios(id,usuario,created_at,updated_at) VALUES ('c','Convidado','2026-10-22','2026-10-22')");
  await storeCatalog(db,[{id:'bar',nome:'Bar',endereco:'Rua',cardapio:[],avaliacoes:[{id:'review',autorId:'c',autor:'Convidado',nota:5,comentario:'Antes de ser dono'}]}],{newId:randomUUID});
  const r={id:'r',bar_id:'bar',kind:'adicionar',recipient_uid:'c',created_by:'a',reason:'Novo sócio',status:'concluida',version:4,base_version:0,access_epoch:0,required_order:'|a|b|c|',queue:'|',accepted_count:3,created_at:now(),updated_at:now(),updated_by:'c',participants:{a:'aceito',b:'aceito',c:'aceito'}};
  const event={actor_uid:'c',vote:'aceito',before:{status:'pendente'},record:r};
  await saveOwnership(db,{bar:{r}},{bar:{r:{4:event}}});
  const list=await readCatalog(db);assert.equal(list[0].avaliacoes[0].elegivelRanking,false);assert.equal(list[0].avaliacoes[0].bloqueadaPorPropriedade,true);
  await storeCatalog(db,list,{newId:randomUUID,enqueue:true,actorId:'c'});
  assert.equal(sql.prepare('SELECT count(*) n FROM sync_queue').get().n,0);
  assert.equal(sql.prepare('SELECT elegivel_ranking FROM avaliacoes_bares').get().elegivel_ranking,1);
  await saveOwnership(db,{},{}); // Mesmo que deixe o bar, a exclusão do ranking permanece.
  assert.equal((await readCatalog(db))[0].avaliacoes[0].elegivelRanking,false);
  const history=sql.prepare('SELECT * FROM vw_historico_propriedade').get();assert.equal(history.estado_novo,'concluida');assert.equal(history.resposta,'aceito');
  sql.close();
});
