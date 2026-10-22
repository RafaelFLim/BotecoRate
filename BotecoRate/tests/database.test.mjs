import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { SCHEMA_SQL } from '../src/database/schema.js';
import { readCatalog, storeCatalog } from '../src/database/catalogStore.js';
import { validateCatalogChange } from '../src/utils/catalogRules.js';
import { calcularNotaMedia } from '../src/utils/nota.js';
import { derivePassword, equalHash } from '../src/utils/passwordHash.js';
import { pbkdf2Sync } from 'node:crypto';

function database() {
  const sql = new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys=ON;'); sql.exec(SCHEMA_SQL);
  const db = {
    getAllAsync: async (query, ...params) => sql.prepare(query).all(...params),
    getFirstAsync: async (query, ...params) => sql.prepare(query).get(...params),
    runAsync: async (query, ...params) => sql.prepare(query).run(...params),
  };
  return { sql, db };
}
const bar = () => ({ id: 'bar', nome: 'Bar de teste', endereco: 'Rua A, 10', detalhes: 'Teste', foto: 'file://foto.jpg',
  latitude: null, longitude: null, proprietarios: ['dono'], avaliacoes: [],
  cardapio: [1,2,3].map(n=>({id: 'item'+n,tipo:'comida',nome:'Item '+n,descricao:'Porção',valor:12.35,foto:null,avaliacoes:[]})) });
const common = { id:'cliente',usuario:'Cliente',origem:'firebase',emailVerificado:true,status:'ativo',papel:'comum' };
const owner = { ...common,id:'dono',papel:'dono' };
const options = { actorId: null, newId: randomUUID };

test('catálogo normalizado preserva centavos, datas legadas e histórico', async () => {
  const {sql,db}=database();const original=bar();original.cardapio[0].criadoEm='2026-08-01T12:00:00.000Z';
  original.cardapio[0].historico=[{nome:'Anterior',valor:10,data:'2026-07-01T12:00:00.000Z'}];
  await storeCatalog(db,[original],{...options,legacy:true});
  assert.equal((await readCatalog(db))[0].cardapio.find(i=>i.id==='item1').valor,12.35);
  assert.equal(sql.prepare('SELECT created_at FROM itens_cardapio WHERE id=?').get('item1').created_at,original.cardapio[0].criadoEm);
  assert.equal((await readCatalog(db))[0].cardapio.find(i=>i.id==='item1').historico[0].valor,10);
  const updated=await readCatalog(db);updated[0].cardapio.find(i=>i.id==='item1').valor=15;
  await storeCatalog(db,updated,options);
  const history=(await readCatalog(db))[0].cardapio.find(i=>i.id==='item1').historico;
  assert.equal(history.at(-1).valor,12.35);
  sql.close();
});

test('exclusão é lógica e repetição sem mudanças não duplica histórico', async () => {
  const {sql,db}=database();await storeCatalog(db,[bar()],options);
  const before=sql.prepare('SELECT COUNT(*) AS n FROM bares_historico').get().n;
  await storeCatalog(db,await readCatalog(db),options);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM bares_historico').get().n,before);
  await storeCatalog(db,[],options);
  assert.equal((await readCatalog(db)).length,0);
  assert.ok(sql.prepare('SELECT deleted_at FROM bares WHERE id=?').get('bar').deleted_at);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM itens_cardapio WHERE deleted_at IS NOT NULL').get().n,3);
  sql.close();
});

test('SQLite impõe FK, preço inteiro, nota inteira, par de coordenadas e avaliação única', () => {
  const {sql}=database();const now='2026-10-22';
  sql.prepare('INSERT INTO usuarios(id,usuario,created_at,updated_at) VALUES (?,?,?,?)').run('u','Nome',now,now);
  sql.prepare('INSERT INTO bares(id,nome,endereco,created_at,updated_at) VALUES (?,?,?,?,?)').run('b','Bar','Rua',now,now);
  assert.throws(()=>sql.prepare('INSERT INTO bares(id,nome,endereco,latitude,created_at,updated_at) VALUES (?,?,?,?,?,?)').run('bad','Bar','Rua',10,now,now));
  assert.throws(()=>sql.prepare('INSERT INTO itens_cardapio(id,bar_id,tipo,nome,descricao,valor_centavos,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').run('i','missing','comida','Item','Texto',100,now,now));
  assert.throws(()=>sql.prepare('INSERT INTO itens_cardapio(id,bar_id,tipo,nome,descricao,valor_centavos,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').run('i','b','comida','Item','Texto',1.5,now,now));
  const query='INSERT INTO avaliacoes_bares(id,bar_id,autor_id,autor_nome,nota,comentario,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)';
  sql.prepare(query).run('r','b','u','Nome',5,'Bom',now,now);
  assert.throws(()=>sql.prepare(query).run('r2','b','u','Nome',4,'Duplicada',now,now));
  assert.throws(()=>sql.prepare(query).run('r3','b',null,'Nome',2.5,'Nota inválida',now,now));
  sql.close();
});

test('falha de gravação reverte também histórico e fila', async () => {
  const {sql,db}=database();sql.exec('BEGIN');
  try { const invalid=bar();invalid.cardapio[2].valor=-1;await storeCatalog(db,[invalid],options);assert.fail('Deveria falhar'); }
  catch { sql.exec('ROLLBACK'); }
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM bares').get().n,0);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM bares_historico').get().n,0);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM sync_queue').get().n,0);
  sql.close();
});

test('permissões: local/não verificado não escreve; comum não cadastra; dono não se avalia', () => {
  assert.throws(()=>validateCatalogChange([],[bar()],{...owner,origem:'local'}));
  assert.throws(()=>validateCatalogChange([],[bar()],{...owner,emailVerificado:false}));
  assert.throws(()=>validateCatalogChange([],[bar()],common));
  assert.doesNotThrow(()=>validateCatalogChange([],[bar()],owner));
  const old=bar(),next=bar();next.avaliacoes=[{id:'r',autorId:'dono',autor:'Dono',nota:5,comentario:'Bom'}];
  assert.throws(()=>validateCatalogChange([old],[next],owner));
  const less=bar();less.cardapio.pop();assert.throws(()=>validateCatalogChange([old],[less],owner));
});

test('fila e histórico são criados junto com a alteração e ranking ignora inelegíveis', async () => {
  const {sql,db}=database();await storeCatalog(db,[bar()],{...options,actorId:'uid',enqueue:true});
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM sync_queue').get().n,4);
  assert.equal(calcularNotaMedia([{nota:5,elegivelRanking:false},{nota:3}]),3);
  assert.equal(calcularNotaMedia([{nota:5,elegivelRanking:false}]),0);
  sql.close();
});

test('opinião de cliente verificado é permitida; editar opinião alheia e forjar ranking não', () => {
  const before=bar(),after=bar();
  after.avaliacoes=[{id:'r',autorId:common.id,autor:common.usuario,nota:4,comentario:'Bom',elegivelRanking:true}];
  assert.doesNotThrow(()=>validateCatalogChange([before],[after],common));
  const tampered=structuredClone(after);tampered.avaliacoes[0].comentario='Alterado';
  assert.throws(()=>validateCatalogChange([after],[tampered],{...common,id:'outro'}));
  tampered.avaliacoes[0].comentario='Bom';tampered.avaliacoes[0].elegivelRanking=false;
  assert.throws(()=>validateCatalogChange([after],[tampered],common));
});

test('hash de senha usa PBKDF2 interoperável com salt e aceita caracteres Unicode', async () => {
  const salt='1234567890abcdef1234567890abcdef';const password='Sênha!😀';
  const derived=await derivePassword(password,salt);
  assert.equal(derived,pbkdf2Sync(password,Buffer.from(salt,'hex'),600000,32,'sha256').toString('hex'));
  assert.ok(equalHash(derived,derived));assert.ok(!equalHash(derived,'0'.repeat(64)));
  assert.ok(!equalHash(derived,derived.slice(1)));
});
