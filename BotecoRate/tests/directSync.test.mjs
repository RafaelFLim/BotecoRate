import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {get,ref,update,set} from 'firebase/database';
import {planModeration} from '../src/services/adminProtocol.js';
import {planDirectCommand,commandReceipt,directSnapshot} from '../src/services/directProtocol.js';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {SCHEMA_SQL} from '../src/database/schema.js';
import {readCatalog,storeCatalog} from '../src/database/catalogStore.js';
import {saveSnapshot,confirmBatch,materializeCatalog} from '../src/database/syncStore.js';

const empty=()=>({entities:{},history:{},owners:{},public_bars:{}});
const publication=(id='b',op='publish')=>({protocol:1,operation_id:op,changes:[
  {entity_type:'bares',entity_id:id,operation:'create',base_version:0,payload:{nome:'Bar',endereco:'Rua',detalhes:'Descrição',foto:'https://example.test/photo.jpg'}},
  ...[1,2,3].map(n=>({entity_type:'itens_cardapio',entity_id:id+'i'+n,operation:'create',base_version:0,payload:{bar_id:id,nome:'Item',descricao:'Porção',tipo:'comida',valor_centavos:100}})),
]});
function apply(state,updates) {
  const result=structuredClone(state);
  for(const [path,value] of Object.entries(updates)) {
    const parts=path.split('/');let parent=result;
    for(const key of parts.slice(0,-1)) parent=parent[key]??={};
    parent[parts.at(-1)]=structuredClone(value);
  }
  return result;
}
test('protocolo preserva publicação atômica, reenvio e versões; normaliza mapas RTDB',()=>{
  const original=empty(),command=publication();
  const plan=planDirectCommand(original,command,'owner','Dono');
  assert.deepEqual(original,empty());
  const state=apply(original,plan.updates);
  assert.equal(commandReceipt(state,command).changes.length,4);
  const reused=structuredClone(command);reused.changes[0].payload.nome='Outro conteúdo';
  assert.throws(()=>commandReceipt(state,reused),e=>e.status===409);
  assert.throws(()=>planDirectCommand(state,publication('b','other'),'owner','Dono'),e=>e.status===409);
  assert.equal(directSnapshot(state).entities.bares.b.proprietarios[0],'owner');
  const numeric=empty();numeric.entities.bares=[null,{id:'1'}];numeric.owners={'1':{owner:true}};
  assert.equal(directSnapshot(numeric).entities.bares['1'].proprietarios[0],'owner');
});
test('protocolo preserva três itens e atualiza referências ao substituir um item',()=>{
  const state=apply(empty(),planDirectCommand(empty(),publication(),'owner','Dono').updates);
  const deletion={entity_type:'itens_cardapio',entity_id:'bi1',operation:'soft_delete',base_version:1,payload:state.entities.itens_cardapio.bi1};
  assert.throws(()=>planDirectCommand(state,{protocol:1,operation_id:'del',changes:[deletion]},'owner','Dono'),/três/);
  const replacement={entity_type:'itens_cardapio',entity_id:'bi4',operation:'create',base_version:0,payload:{...state.entities.itens_cardapio.bi1,id:'bi4'}};
  const plan=planDirectCommand(state,{protocol:1,operation_id:'replace',changes:[deletion,replacement]},'owner','Dono');
  assert.equal(plan.updates['entities/bares/b'].version,2);
  assert.equal(plan.updates['entities/bares/b'].item_a,'bi2');
});

const enabled=Boolean(process.env.FIREBASE_DATABASE_EMULATOR_HOST);
const options={skip:!enabled};
let env;
before(async()=>{
  if(!enabled)return;
  env=await initializeTestEnvironment({projectId:'demo-direct-tests',database:{rules:readFileSync(new URL('../firebase/database.rules.json',import.meta.url),'utf8')}});
});
after(async()=>{if(env)await env.cleanup();});
async function reset() {
  await env.clearDatabase();
  await env.withSecurityRulesDisabled(ctx=>set(ref(ctx.database(),'v1'),{direct:empty(),access_control:{owner:{role:'dono',status:'ativo'},admin:{role:'admin',status:'ativo'},banned:{role:'admin',status:'banido'}}}));
}
const account=(uid,verified=true)=>env.authenticatedContext(uid,{email_verified:verified}).database();
async function state(db){return (await get(ref(db,'v1/direct'))).val()||empty();}
async function publish(db=account('owner'),id='b') {
  const plan=planDirectCommand(await state(db),publication(id,'pub_'+id),'owner','Dono');
  await assertSucceeds(update(ref(db,'v1/direct'),plan.updates));return state(db);
}
test('SDK direto: publicação por dono, leitura pública limitada, comum e não verificado bloqueados',options,async()=>{
  await reset();const db=account('owner');await publish(db);
  const visitor=env.unauthenticatedContext().database();
  await assertSucceeds(get(ref(visitor,'v1/direct/public_bars')));
  await assertFails(get(ref(visitor,'v1/direct')));
  const plan=planDirectCommand(empty(),publication('other'),'common','Comum');
  await assertFails(update(ref(account('common'),'v1/direct'),plan.updates));
  await assertFails(update(ref(account('owner',false),'v1/direct'),plan.updates));
});
test('SDK direto: versões concorrentes, confirmação perdida e histórico obrigatório/imutável',options,async()=>{
  await reset();const db=account('owner');const initial=await publish(db);
  const command={protocol:1,operation_id:'edit',changes:[{entity_type:'bares',entity_id:'b',operation:'update',base_version:1,payload:{...initial.entities.bares.b,nome:'Novo'}}]};
  const plan=planDirectCommand(initial,command,'owner','Dono');
  const bad=structuredClone(plan.updates);delete bad['history/bares/b/2'];
  await assertFails(update(ref(db,'v1/direct'),bad));
  const forged=structuredClone(plan.updates);forged['history/bares/b/2'].before.nome='Falso';
  await assertFails(update(ref(db,'v1/direct'),forged));
  const missingHash=structuredClone(plan.updates);delete missingHash['history/bares/b/2'].command_hash;
  await assertFails(update(ref(db,'v1/direct'),missingHash));
  await assertSucceeds(update(ref(db,'v1/direct'),plan.updates));
  assert.equal(commandReceipt(await state(db),command).changes[0].record.nome,'Novo');
  const concurrent=planDirectCommand(initial,{...command,operation_id:'other'},'owner','Dono');
  await assertFails(update(ref(db,'v1/direct'),concurrent.updates));
  await assertFails(set(ref(db,'v1/direct/history/bares/b/2'),null));
  await assertFails(set(ref(db,'v1/direct/history/bares/b'),null));
  await assertFails(set(ref(account('common'),'v1/access_control/common'),{role:'admin',status:'ativo'}));
});
test('SDK direto: avaliações únicas, sem autoavaliação, autoria protegida e conta banida bloqueada',options,async()=>{
  await reset();const db=account('owner');let current=await publish(db);
  const review=(uid,id,op)=>({protocol:1,operation_id:op,changes:[{entity_type:'avaliacoes_bares',entity_id:id,operation:'create',base_version:0,payload:{bar_id:'b',nota:5,comentario:'Bom',autor_id:uid}}]});
  await assertFails(update(ref(db,'v1/direct'),planDirectCommand(current,review('owner','rOwner','self'),'owner','Dono').updates));
  const user=account('common');const plan=planDirectCommand(current,review('common','r','review'),'common','Pessoa');
  await assertSucceeds(update(ref(user,'v1/direct'),plan.updates));
  current=await state(user);
  await assertFails(update(ref(user,'v1/direct'),planDirectCommand(current,review('common','r2','again'),'common','Pessoa').updates));
  const forged=planDirectCommand(current,review('other','rOther','spoof'),'other','Outro').updates;
  await assertFails(update(ref(user,'v1/direct'),forged));
  await assertFails(update(ref(account('banned'),'v1/direct'),planDirectCommand(current,review('banned','rb','ban'),'banned','Banido').updates));
  await assertFails(update(ref(account('admin'),'v1/direct'),planDirectCommand(current,{protocol:1,operation_id:'rewrite',changes:[{entity_type:'avaliacoes_bares',entity_id:'r',operation:'update',base_version:1,payload:{...current.entities.avaliacoes_bares.r,comentario:'Admin reescreveu'}}]},'admin','Admin').updates));
});
test('SDK direto: mínimo de três itens, propriedade alheia e tombstone contra ressurreição',options,async()=>{
  await reset();const db=account('owner');let current=await publish(db);
  const command={protocol:1,operation_id:'delitem',changes:[{entity_type:'itens_cardapio',entity_id:'bi1',operation:'update',base_version:1,payload:{...current.entities.itens_cardapio.bi1,nome:'Novo'}}]};
  const wrong=planDirectCommand(current,command,'common','Comum');
  await assertFails(update(ref(account('common'),'v1/direct'),wrong.updates));
  const deletion=planDirectCommand(current,command,'owner','Dono').updates;
  const row={...current.entities.itens_cardapio.bi1,version:2,last_operation:'delitem',deleted_at:'2026-10-22',updated_at:'2026-10-22'};
  deletion['entities/itens_cardapio/bi1']=row;
  deletion['history/itens_cardapio/bi1/2']={...deletion['history/itens_cardapio/bi1/2'],actor_uid:'owner',operation_id:'delitem',operation:'soft_delete',before:current.entities.itens_cardapio.bi1,record:row};
  await assertFails(update(ref(db,'v1/direct'),deletion));
  const deleteBar={protocol:1,operation_id:'deletebar',changes:[{entity_type:'bares',entity_id:'b',operation:'soft_delete',base_version:1,payload:current.entities.bares.b}]};
  await assertSucceeds(update(ref(db,'v1/direct'),planDirectCommand(current,deleteBar,'owner','Dono').updates));
  current=await state(db);
  const restore=structuredClone(current.entities.bares.b);delete restore.deleted_at;restore.version=3;
  await assertFails(set(ref(db,'v1/direct/entities/bares/b'),restore));
});

test('duas réplicas SQLite: offline, envio SDK, download, conflito e fila preservada',options,async()=>{
  await reset();const remote=account('owner');await publish(remote);
  function device() {
    const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');sql.exec(SCHEMA_SQL);
    const db={getAllAsync:async(q,...p)=>sql.prepare(q).all(...p),getFirstAsync:async(q,...p)=>sql.prepare(q).get(...p),runAsync:async(q,...p)=>sql.prepare(q).run(...p)};
    return {sql,db};
  }
  const a=device(),b=device();
  try {
    const initial=await state(remote);
    for(const d of [a,b]) await saveSnapshot(d.db,directSnapshot(structuredClone(initial)),'owner');
    const offline=await readCatalog(a.db);offline[0].nome='Mudança offline';
    await storeCatalog(a.db,offline,{actorId:'owner',enqueue:true,newId:randomUUID});
    const other=await readCatalog(b.db);other[0].nome='Proposta do segundo aparelho';
    await storeCatalog(b.db,other,{actorId:'owner',enqueue:true,newId:randomUUID});
    assert.equal((await readCatalog(b.db))[0].nome,'Proposta do segundo aparelho');
    const batch=await a.db.getFirstAsync('SELECT * FROM sync_batches');
    const plan=planDirectCommand(await state(remote),JSON.parse(batch.payload),'owner','Dono');
    await assertSucceeds(update(ref(remote,'v1/direct'),plan.updates));
    await confirmBatch(a.db,batch,plan.receipt);
    await saveSnapshot(a.db,directSnapshot(await state(remote)),'owner');
    assert.equal((await a.db.getFirstAsync('SELECT COUNT(*) n FROM sync_queue')).n,0);
    assert.equal((await readCatalog(a.db))[0].nome,'Mudança offline');
    await saveSnapshot(b.db,directSnapshot(await state(remote)),'owner');
    assert.equal((await readCatalog(b.db))[0].nome,'Proposta do segundo aparelho');
    const stale=JSON.parse((await b.db.getFirstAsync('SELECT payload FROM sync_batches')).payload);
    const fresh=await state(remote);
    assert.throws(()=>planDirectCommand(fresh,stale,'owner','Dono'),e=>e.status===409);
    await materializeCatalog(b.db,'other');
    assert.equal((await readCatalog(b.db))[0].nome,'Mudança offline');
    assert.equal((await b.db.getFirstAsync('SELECT COUNT(*) n FROM sync_queue')).n,1);
  } finally {a.sql.close();b.sql.close();}
});

test('SDK direto: autor não contorna moderação apagando a opinião para cadastrar outra',options,async()=>{
  await reset();await publish();const db=account('common');
  let current=await state(db);
  const command={protocol:1,operation_id:'review-mod',changes:[{entity_type:'avaliacoes_bares',entity_id:'r-mod',operation:'create',base_version:0,payload:{bar_id:'b',nota:5,comentario:'Original'}}]};
  await assertSucceeds(update(ref(db,'v1/direct'),planDirectCommand(current,command,'common','Cliente').updates));
  const plan=planModeration(null,{table:'avaliacoes_bares',id:'r-mod',status:'oculta',actor:'admin',reason:'Conteúdo inadequado',operationId:'moderate',now:new Date().toISOString()});
  await assertSucceeds(update(ref(account('admin'),'v1'),plan));
  current=await state(db);
  const deletion={protocol:1,operation_id:'bypass-mod',changes:[{entity_type:'avaliacoes_bares',entity_id:'r-mod',operation:'soft_delete',base_version:1,payload:current.entities.avaliacoes_bares['r-mod']}]};
  await assertFails(update(ref(db,'v1/direct'),planDirectCommand(current,deletion,'common','Cliente').updates));
});
