import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {get,ref,set,update} from 'firebase/database';
import {planAccessChange,planModeration} from '../src/services/adminProtocol.js';
import {SCHEMA_SQL} from '../src/database/schema.js';
import {readCatalog,storeCatalog} from '../src/database/catalogStore.js';
import {saveModeration} from '../src/database/moderationStore.js';
const args={actor:'admin',uid:'alice',action:'banir',reason:'Abuso confirmado',operationId:'op',now:'2026-10-22T12:00:00.000Z'};
test('protocolo exige motivo, protege autoalteração e não reescreve avaliação',()=>{
  assert.throws(()=>planAccessChange(null,{...args,uid:'admin'}),/próprio/);
  assert.throws(()=>planAccessChange(null,{...args,reason:'  '}),/justificativa/);
  const plan=planAccessChange(null,args);
  assert.equal(plan['access_control/alice'].status,'banido');
  assert.deepEqual(plan['access_history/alice/1'].before,{absent:true});
  const mod=planModeration(null,{...args,table:'avaliacoes_bares',id:'r',status:'oculta'});
  assert.ok(Object.keys(mod).every(k=>!k.includes('entities')));
});
test('SQLite conserva opinião oculta, exclui do ranking e não enfileira exclusão acidental',async()=>{
  const sql=new DatabaseSync(':memory:');sql.exec(SCHEMA_SQL);
  const db={getAllAsync:async(q,...p)=>sql.prepare(q).all(...p),getFirstAsync:async(q,...p)=>sql.prepare(q).get(...p),runAsync:async(q,...p)=>sql.prepare(q).run(...p)};
  await db.runAsync("INSERT INTO usuarios(id,usuario,created_at,updated_at) VALUES ('alice','Alice','2026-10-22','2026-10-22')");
  const bar={id:'b',nome:'Bar',endereco:'Rua',avaliacoes:[{id:'r',nota:5,comentario:'Texto original',autorId:'alice',autor:'Alice'}],cardapio:[]};
  await storeCatalog(db,[bar],{newId:randomUUID});
  const updates=planModeration(null,{...args,table:'avaliacoes_bares',id:'r',status:'oculta'});
  const record=updates['direct/moderation/avaliacoes_bares/r'];
  await saveModeration(db,{avaliacoes_bares:{r:record}},{avaliacoes_bares:{r:{1:updates['direct/moderation_history/avaliacoes_bares/r/1']}}});
  const visible=await readCatalog(db);assert.equal(visible[0].avaliacoes.length,0);
  await storeCatalog(db,visible,{newId:randomUUID,enqueue:true,actorId:'alice'});
  const row=sql.prepare('SELECT * FROM avaliacoes_bares').get();
  assert.equal(row.comentario,'Texto original');assert.equal(row.deleted_at,null);
  assert.equal(sql.prepare('SELECT count(*) n FROM sync_queue').get().n,0);
  assert.equal(sql.prepare('SELECT count(*) n FROM review_moderation_historico').get().n,1);
  await saveModeration(db,{avaliacoes_bares:{r:{...record,status:'visivel',version:2}}});
  assert.equal((await readCatalog(db))[0].avaliacoes.length,1);sql.close();
});
const enabled=Boolean(process.env.FIREBASE_DATABASE_EMULATOR_HOST), options={skip:!enabled};let env;
before(async()=>{if(enabled)env=await initializeTestEnvironment({projectId:'demo-admin-tests',database:{rules:readFileSync(new URL('../firebase/database.rules.json',import.meta.url),'utf8')}});});
after(async()=>{if(env)await env.cleanup();});
const account=(uid,verified=true)=>env.authenticatedContext(uid,{email_verified:verified,email:`${uid}@example.test`}).database();
async function reset(){await env.clearDatabase();await env.withSecurityRulesDisabled(ctx=>set(ref(ctx.database(),'v1'),{
  access_control:{admin:{role:'admin',status:'ativo'},second:{role:'admin',status:'ativo'},banned:{role:'admin',status:'banido'}},
  user_directory:Object.fromEntries(['admin','second','alice','unverified'].map(uid=>[uid,{uid,name:uid,email:`${uid}@example.test`,email_verified:uid!=='unverified',updated_at:args.now}])),
  direct:{entities:{avaliacoes_bares:{r:{id:'r',nota:5,comentario:'Original',autor_id:'alice'}}}},
}));}
test('admin: diretório privado e mudanças auditadas; comum, dono, não verificado e banido não administram',options,async()=>{
  await reset();const plan=planAccessChange(null,args);
  for(const uid of ['alice','banned']){const db=account(uid);await assertFails(get(ref(db,'v1/user_directory')));await assertFails(update(ref(db,'v1'),plan));}
  await assertFails(update(ref(account('admin',false),'v1'),plan));
  await assertSucceeds(get(ref(account('admin'),'v1/user_directory')));
  await assertSucceeds(update(ref(account('admin'),'v1'),plan));
  await assertFails(get(ref(account('alice'),'v1/direct')));
  await assertFails(set(ref(account('admin'),'v1/access_history/alice/1'),null));
  await assertFails(update(ref(account('admin'),'v1'),plan));
});
test('admin: não muda próprio acesso; versão, motivo, histórico e e-mail verificado obrigatórios',options,async()=>{
  await reset();const db=account('admin');
  const promotion=planAccessChange(null,{...args,action:'admin'});
  const missing={...promotion};delete missing['access_history/alice/1'];
  await assertFails(update(ref(db,'v1'),missing));
  const short=structuredClone(promotion);for(const v of Object.values(short)){if(v.record)v.record.reason='x';else if(typeof v==='object')v.reason='x';}
  await assertFails(update(ref(db,'v1'),short));
  const unverified=planAccessChange(null,{...args,uid:'unverified',action:'admin'});
  await assertFails(update(ref(db,'v1'),unverified));
  const self=Object.fromEntries(Object.entries(promotion).map(([k,v])=>[k.replace('/alice','/admin'),v]));
  await assertFails(update(ref(db,'v1'),self));
  await assertSucceeds(update(ref(db,'v1'),promotion));
  const bad=planAccessChange(promotion['access_control/alice'],{...args,action:'banir',operationId:'second'});
  const misleading=structuredClone(bad);misleading['access_history/alice/2'].before.absent=true;
  await assertFails(update(ref(db,'v1'),misleading));
  bad['access_history/alice/2'].before.role='comum';
  await assertFails(update(ref(db,'v1'),bad));
});
test('admin: moderação imutável e atômica preserva conteúdo; autor e admin banido não moderam',options,async()=>{
  await reset();const db=account('admin');
  const plan=planModeration(null,{...args,table:'avaliacoes_bares',id:'r',status:'oculta'});
  await assertFails(update(ref(account('alice'),'v1'),plan));
  await assertFails(update(ref(account('banned'),'v1'),plan));
  await assertSucceeds(update(ref(db,'v1'),plan));
  assert.equal((await get(ref(db,'v1/direct/entities/avaliacoes_bares/r/comentario'))).val(),'Original');
  await assertFails(set(ref(db,'v1/direct/moderation_history/avaliacoes_bares/r/1'),null));
  const restore=planModeration(plan['direct/moderation/avaliacoes_bares/r'],{...args,table:'avaliacoes_bares',id:'r',status:'visivel',operationId:'restore'});
  await assertSucceeds(update(ref(db,'v1'),restore));
  const ghost=planModeration(null,{...args,table:'avaliacoes_itens',id:'missing',status:'oculta'});
  await assertFails(update(ref(db,'v1'),ghost));
});
test('diretório: usuário publica somente identidade própria coerente com token, nunca papel',options,async()=>{
  await reset();const db=account('alice');const row={uid:'alice',name:'Alice',email:'alice@example.test',email_verified:true,updated_at:args.now};
  await assertSucceeds(set(ref(db,'v1/user_directory/alice'),row));
  await assertFails(set(ref(db,'v1/user_directory/second'),{...row,uid:'second'}));
  await assertFails(set(ref(db,'v1/user_directory/alice'),{...row,email:'other@example.test'}));
  await assertFails(set(ref(db,'v1/user_directory/alice'),{...row,role:'admin'}));
});
test('lixeira administrativa: prazo de 30 dias, restauração auditada e prazo vencido bloqueado no servidor',options,async()=>{
  await reset();const db=account('admin'),now=new Date().toISOString();
  const deleted=planAccessChange(null,{...args,now,action:'excluir'});
  await assertSucceeds(update(ref(db,'v1'),deleted));
  const row=deleted['access_control/alice'];assert.equal(row.purge_after-Date.parse(now),30*86400000);
  await assertSucceeds(update(ref(db,'v1'),planAccessChange(row,{...args,now,accessEpoch:1,action:'restaurar',operationId:'restore-user'})));
  const mod=planModeration(null,{...args,now,table:'avaliacoes_bares',id:'r',status:'excluida'});
  await assertSucceeds(update(ref(db,'v1'),mod));
  const restored=planModeration(mod['direct/moderation/avaliacoes_bares/r'],{...args,now,table:'avaliacoes_bares',id:'r',status:'visivel',operationId:'restore-review'});
  await assertSucceeds(update(ref(db,'v1'),restored));
  // Simula passagem do prazo sem esperar 30 dias; só o fixture usa acesso privilegiado.
  await env.withSecurityRulesDisabled(ctx=>update(ref(ctx.database(),'v1/access_control/alice'),{...row,purge_after:Date.now()-1}));
  const forged=planAccessChange(row,{...args,now,action:'restaurar',operationId:'expired'});
  await assertFails(update(ref(db,'v1'),forged));
});
test('histórico: consultas SQL legíveis e indexadas expõem motivo e valores sem abrir JSON',async()=>{
  const sql=new DatabaseSync(':memory:');sql.exec(SCHEMA_SQL);
  sql.prepare('INSERT INTO admin_access_historico VALUES (?,?,?,?,?,?,?)').run('a','alice','admin','Abuso confirmado',JSON.stringify({role:'comum',status:'ativo'}),JSON.stringify({role:'comum',status:'banido'}),args.now);
  const event=sql.prepare('SELECT * FROM vw_historico_acessos WHERE usuario_id=?').get('alice');
  assert.equal(event.estado_anterior,'ativo');assert.equal(event.estado_novo,'banido');assert.equal(event.justificativa,'Abuso confirmado');
  sql.exec('PRAGMA user_version=3;');sql.exec(SCHEMA_SQL); // migração aditiva/idempotente
  assert.equal(sql.prepare('SELECT count(*) n FROM admin_access_historico').get().n,1);sql.close();
});
