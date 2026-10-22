import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { SCHEMA_SQL } from '../src/database/schema.js';
import { readCatalog, storeCatalog } from '../src/database/catalogStore.js';
import { initializeSync, materializeCatalog, saveSnapshot, confirmBatch, failBatch, discardPending, saveRecords } from '../src/database/syncStore.js';

function database() {
  const sql = new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys=ON;'); sql.exec(SCHEMA_SQL);
  const db = {
    getAllAsync: async (query,...params)=>sql.prepare(query).all(...params),
    getFirstAsync: async (query,...params)=>sql.prepare(query).get(...params),
    runAsync: async (query,...params)=>sql.prepare(query).run(...params),
  };
  return {sql,db};
}
const bar = () => ({id:'bar',nome:'Bar',endereco:'Rua A',detalhes:'Teste',foto:'https://api.test/photo',latitude:null,longitude:null,proprietarios:['owner'],avaliacoes:[],
  cardapio:[1,2,3].map(n=>({id:'item'+n,tipo:'comida',nome:'Item',descricao:'Porção',valor:10,avaliacoes:[],foto:null}))});
const options = {newId:randomUUID};
async function snapshot(db) {
  const source = database();
  await storeCatalog(source.db,[bar()],options);
  const entities = {};
  for (const table of ['bares','itens_cardapio','avaliacoes_bares','avaliacoes_itens']) {
    entities[table] = Object.fromEntries((await source.db.getAllAsync(`SELECT * FROM ${table}`)).map(row=>[row.id,{...row,...(table==='bares'?{proprietarios:['owner']}:{})}]));
  }
  source.sql.close();
  await saveSnapshot(db,{protocol:1,sequence:1,entities},null);
}

test('troca de conta oculta alterações e fotos pendentes, preservando a fila original', async()=>{
  const {sql,db}=database();await initializeSync(db,randomUUID);await snapshot(db);
  await materializeCatalog(db,'owner');
  const before=await readCatalog(db);before[0].nome='Rascunho privado';before[0].foto='file:///privado.jpg';
  await storeCatalog(db,before,{...options,actorId:'owner',enqueue:true});
  await materializeCatalog(db,'other');
  assert.equal((await readCatalog(db))[0].nome,'Bar');
  assert.equal((await readCatalog(db))[0].foto,'https://api.test/photo');
  await materializeCatalog(db,'owner');
  assert.equal((await readCatalog(db))[0].nome,'Rascunho privado');
  assert.equal((await db.getFirstAsync('SELECT COUNT(*) AS n FROM sync_queue')).n,1);
  sql.close();
});

test('criação agrupa bar e três itens; versão-base vem da réplica confirmada',async()=>{
  const {sql,db}=database();await initializeSync(db,randomUUID);
  await storeCatalog(db,[bar()],{...options,actorId:'owner',enqueue:true});
  let batches=await db.getAllAsync('SELECT * FROM sync_batches');
  assert.equal(batches.length,1);assert.equal(JSON.parse(batches[0].payload).changes.length,4);
  assert.ok(JSON.parse(batches[0].payload).changes.every(c=>c.base_version===0));
  let current=await readCatalog(db);current[0].nome='Segundo';
  await storeCatalog(db,current,{...options,actorId:'owner',enqueue:true});
  batches=await db.getAllAsync('SELECT * FROM sync_batches ORDER BY rowid');
  assert.equal(JSON.parse(batches[1].payload).changes[0].base_version,1);
  const changes=JSON.parse(batches[0].payload).changes.map(c=>({entity_type:c.entity_type,entity_id:c.entity_id,record:{...c.payload,version:1,...(c.entity_type==='bares'?{proprietarios:['owner']}:{})}}));
  await confirmBatch(db,batches[0],{operation_id:batches[0].operation_id,changes});
  await materializeCatalog(db,'owner');
  assert.equal((await readCatalog(db))[0].nome,'Segundo');
  assert.equal((await db.getFirstAsync('SELECT COUNT(*) AS n FROM sync_queue')).n,1);
  assert.equal((await db.getFirstAsync("SELECT value FROM app_settings WHERE key='sync_cursor'")),undefined);
  sql.close();
});

test('conflito conserva local/remoto, não repete permanentemente e permite escolher servidor',async()=>{
  const {sql,db}=database();await initializeSync(db,randomUUID);await snapshot(db);
  const edited=await readCatalog(db);edited[0].nome='Meu nome';
  await storeCatalog(db,edited,{...options,actorId:'owner',enqueue:true});
  const batch=await db.getFirstAsync('SELECT * FROM sync_batches');
  assert.equal(await failBatch(db,batch,{status:409,message:'Conflito',body:{remote:{nome:'Remoto'}}}), 'conflito');
  assert.ok((await db.getFirstAsync('SELECT local_json FROM sync_conflicts')).local_json.includes('Meu nome'));
  await materializeCatalog(db,'owner');assert.equal((await readCatalog(db))[0].nome,'Meu nome');
  await discardPending(db,'owner');assert.equal((await readCatalog(db))[0].nome,'Bar');
  assert.equal((await db.getFirstAsync('SELECT COUNT(*) AS n FROM sync_batches')).n,0);
  assert.equal((await db.getFirstAsync('SELECT COUNT(*) AS n FROM sync_conflicts')).n,1);
  sql.close();
});

test('falhas transitórias recebem backoff e snapshot não apaga proposta offline',async()=>{
  const {sql,db}=database();await initializeSync(db,randomUUID);await snapshot(db);
  const edited=await readCatalog(db);edited[0].nome='Offline';
  await storeCatalog(db,edited,{...options,actorId:'owner',enqueue:true});
  const batch=await db.getFirstAsync('SELECT * FROM sync_batches');
  assert.equal(await failBatch(db,batch,{message:'Sem rede'},1000),'pendente');
  assert.equal((await db.getFirstAsync('SELECT next_attempt_at FROM sync_batches')).next_attempt_at,2000);
  await snapshot(db);await materializeCatalog(db,'owner');
  assert.equal((await readCatalog(db))[0].nome,'Offline');
  sql.close();
});

test('migração v1 conserva fila em revisão e não expõe criação a outra conta',async()=>{
  const {sql,db}=database();
  await storeCatalog(db,[bar()],{...options,actorId:'owner',enqueue:true});
  await db.runAsync('DELETE FROM sync_batches'); // formato da etapa 1
  await initializeSync(db,randomUUID);
  assert.equal((await db.getFirstAsync('SELECT status FROM sync_batches')).status,'rejeitada');
  await materializeCatalog(db,'other');assert.equal((await readCatalog(db)).length,0);
  await materializeCatalog(db,'owner');assert.equal((await readCatalog(db)).length,1);
  sql.close();
});

test('RTDB omite null: confirmação repõe tombstone e coordenadas sem ocultar registro ativo',async()=>{
  const {sql,db}=database();await initializeSync(db,randomUUID);await snapshot(db);
  const row=JSON.parse((await db.getFirstAsync("SELECT payload FROM sync_entities WHERE entity_type='bares'")).payload);
  delete row.deleted_at;delete row.latitude;delete row.longitude;row.version=2;
  await saveRecords(db,[{entity_type:'bares',entity_id:row.id,record:row}]);
  await materializeCatalog(db,null);await materializeCatalog(db,null);
  assert.equal((await readCatalog(db)).length,1);
  assert.equal((await readCatalog(db))[0].latitude,null);
  sql.close();
});

test('opinião offline duplicada não quebra projeção ao chegar avaliação do outro aparelho',async()=>{
  const {sql,db}=database();await initializeSync(db,randomUUID);await snapshot(db);
  await db.runAsync("INSERT INTO usuarios(id,usuario,created_at,updated_at) VALUES ('customer','Cliente','now','now')");
  const edited=await readCatalog(db);edited[0].avaliacoes=[{id:'local',autorId:'customer',autor:'Cliente',nota:4,comentario:'Local'}];
  await storeCatalog(db,edited,{...options,actorId:'customer',enqueue:true});
  const local=JSON.parse((await db.getFirstAsync('SELECT payload FROM sync_queue')).payload);
  await saveRecords(db,[{entity_type:'avaliacoes_bares',entity_id:'remote',record:{...local,id:'remote',comentario:'Outro aparelho'}}]);
  await materializeCatalog(db,'customer');assert.equal((await readCatalog(db))[0].avaliacoes[0].id,'local');
  await materializeCatalog(db,null);assert.equal((await readCatalog(db))[0].avaliacoes[0].id,'remote');
  sql.close();
});

test('invalidação remota do ranking prevalece sobre rascunho antigo e sobre fim do vínculo', async () => {
  const {sql,db}=database();
  try {
    await initializeSync(db,randomUUID);await snapshot(db);
    await db.runAsync("INSERT INTO usuarios(id,usuario,created_at,updated_at) VALUES ('customer','Cliente','now','now')");
    const list=await readCatalog(db);
    list[0].avaliacoes=[{id:'review',autorId:'customer',autor:'Cliente',nota:5,comentario:'Rascunho'}];
    await storeCatalog(db,list,{...options,actorId:'customer',enqueue:true});
    const queued=JSON.parse((await db.getFirstAsync("SELECT payload FROM sync_queue WHERE entity_id='review'")).payload);
    await saveRecords(db,[{entity_type:'avaliacoes_bares',entity_id:'review',record:{...queued,version:2,elegivel_ranking:0,comentario:'Confirmada'}}]);
    await materializeCatalog(db,'customer');
    let review=(await readCatalog(db))[0].avaliacoes[0];
    assert.equal(review.comentario,'Rascunho');assert.equal(review.elegivelRanking,false);
    const remoteBar=JSON.parse((await db.getFirstAsync("SELECT payload FROM sync_entities WHERE entity_type='bares'")).payload);
    await saveRecords(db,[{entity_type:'bares',entity_id:'bar',record:{...remoteBar,version:2,proprietarios:[]}}]);
    await materializeCatalog(db,'customer');
    review=(await readCatalog(db))[0].avaliacoes[0];assert.equal(review.elegivelRanking,false);
    await materializeCatalog(db,null);review=(await readCatalog(db))[0].avaliacoes[0];
    assert.equal(review.comentario,'Confirmada');assert.equal(review.elegivelRanking,false);
  } finally {sql.close();}
});
