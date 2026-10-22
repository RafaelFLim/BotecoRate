import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { SCHEMA_SQL } from '../src/database/schema.js';
import { readCatalog, storeCatalog, TABLES } from '../src/database/catalogStore.js';
import { validateCatalogChange } from '../src/utils/catalogRules.js';
import { prepareBarEdit, prepareBarDeletion } from '../src/utils/barManagement.js';
import { calcularNotaMedia, avaliacaoContaNoRanking } from '../src/utils/nota.js';

const owner = { id: 'owner', usuario: 'Dono', origem: 'firebase', emailVerificado: true, status: 'ativo', papel: 'dono' };
const admin = { ...owner, id: 'admin', papel: 'admin' };
const bar = () => ({ id: 'bar', nome: 'Bar', endereco: 'Rua A', detalhes: 'Ambiente', foto: 'https://example.test/photo', version: 1,
  latitude: -21, longitude: -43, proprietarios: ['owner'], avaliacoes: [],
  cardapio: [1, 2, 3].map(n => ({ id: `item${n}`, tipo: 'comida', nome: 'Porção', descricao: 'Teste', valor: 10, foto: null, avaliacoes: [] })) });
const patch = initial => ({ ...initial, nome: 'Novo nome', endereco: 'Rua B', latitude: null, longitude: null });

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

test('gestão permite dono vinculado e admin; rejeita comum, outro dono, local, não verificado e banido', () => {
  const initial = bar();
  for (const user of [owner, admin]) {
    assert.doesNotThrow(() => prepareBarEdit([initial], initial.id, patch(initial), initial, user));
    assert.deepEqual(prepareBarDeletion([initial], initial.id, initial, user), []);
  }
  for (const user of [null, { ...owner, id: 'other' }, { ...owner, papel: 'comum' }, { ...owner, origem: 'local' }, { ...owner, emailVerificado: false }, { ...admin, status: 'banido' }]) {
    assert.throws(() => prepareBarEdit([initial], initial.id, patch(initial), initial, user), /permissão/);
    assert.throws(() => prepareBarDeletion([initial], initial.id, initial, user), /permissão/);
  }
});

test('edição preserva cardápio, opiniões recentes, autoria e donos; rascunho não altera autoridade', () => {
  const initial = bar();
  const current = { ...initial, avaliacoes: [{ id: 'r', autorId: 'customer', nota: 4 }] };
  const next = prepareBarEdit([current], 'bar', { ...patch(initial), proprietarios: ['attacker'], criadoPor: 'attacker', cardapio: [] }, initial, owner);
  assert.equal(next[0].nome, 'Novo nome');
  assert.deepEqual(next[0].cardapio, current.cardapio);
  assert.deepEqual(next[0].avaliacoes, current.avaliacoes);
  assert.deepEqual(next[0].proprietarios, ['owner']);
  assert.equal(next[0].criadoPor, current.criadoPor);
  assert.doesNotThrow(() => validateCatalogChange([current], next, owner));
  assert.equal(initial.nome, 'Bar');
});

test('edição e exclusão rejeitam formulário desatualizado, bar removido e vínculo perdido', () => {
  const initial = bar();
  for (const current of [{ ...initial, version: 2 }, { ...initial, endereco: 'Mudou' }, { ...initial, foto: 'https://example.test/other' }]) {
    assert.throws(() => prepareBarEdit([current], 'bar', patch(initial), initial, owner), /mudaram/);
    assert.throws(() => prepareBarDeletion([current], 'bar', initial, owner), /mudaram/);
  }
  assert.throws(() => prepareBarDeletion([], 'bar', initial, owner), /excluído/);
  assert.throws(() => prepareBarEdit([{ ...initial, proprietarios: ['other'] }], 'bar', patch(initial), initial, owner), /permissão/);
});

test('regras impedem apagar dados obrigatórios, coordenadas inválidas e mudar proprietários pelo catálogo', () => {
  const initial = bar();
  for (const data of [{ nome: ' ' }, { endereco: '' }, { detalhes: '' }, { foto: null }, { latitude: 91 }, { longitude: null }, { longitude: Infinity }, { nome: 'a'.repeat(151) }]) {
    const next = { ...initial, ...data };
    assert.throws(() => prepareBarEdit([initial], 'bar', next, initial, owner));
    assert.throws(() => validateCatalogChange([initial], [next], owner));
  }
  assert.throws(() => validateCatalogChange([initial], [{ ...initial, proprietarios: ['other'] }], owner), /propriedade/);
});

test('editar gera histórico e um comando; excluir gera um lote com tombstones de todos os filhos', async () => {
  const { sql, db } = database();
  try {
    await db.runAsync("INSERT INTO usuarios(id,usuario,created_at,updated_at) VALUES ('customer','Cliente','now','now')");
    const initial = bar();
    initial.avaliacoes = [{ id: 'review', autorId: 'customer', autor: 'Cliente', nota: 4, comentario: 'Bom' }];
    initial.cardapio[0].avaliacoes = [{ id: 'itemreview', autorId: 'customer', autor: 'Cliente', nota: 5, comentario: 'Bom' }];
    await storeCatalog(db, [initial], { newId: randomUUID });
    await db.runAsync("INSERT INTO usuarios(id,usuario,created_at,updated_at) VALUES ('owner','Dono','now','now')");
    await db.runAsync("INSERT INTO bar_proprietarios(bar_id,usuario_id,created_at,updated_at) VALUES ('bar','owner','now','now')");
    let current = (await readCatalog(db))[0];
    const next = prepareBarEdit([current], 'bar', patch(current), current, owner);
    validateCatalogChange([current], next, owner);
    await storeCatalog(db, next, { actorId: owner.id, enqueue: true, newId: randomUUID });
    assert.equal((await db.getAllAsync('SELECT * FROM sync_queue')).length, 1);
    const history = await db.getFirstAsync("SELECT * FROM bares_historico WHERE acao='update'");
    assert.equal(JSON.parse(history.snapshot_json).nome, 'Bar');
    // Simula a confirmação da edição antes de testar o próximo lote offline.
    await db.runAsync('DELETE FROM sync_queue'); await db.runAsync('DELETE FROM sync_batches');
    current = (await readCatalog(db))[0];
    const removed = prepareBarDeletion([current], 'bar', current, owner);
    validateCatalogChange([current], removed, owner);
    await storeCatalog(db, removed, { actorId: owner.id, enqueue: true, newId: randomUUID });
    assert.equal((await readCatalog(db)).length, 0);
    const batches = await db.getAllAsync('SELECT * FROM sync_batches');
    const changes = JSON.parse(batches[0].payload).changes;
    assert.equal(batches.length, 1); assert.equal(changes.length, 6);
    assert.ok(changes.every(change => change.operation === 'soft_delete'));
    for (const table of TABLES) assert.equal((await db.getAllAsync(`SELECT * FROM ${table} WHERE deleted_at IS NULL`)).length, 0);
    assert.equal((await db.getFirstAsync("SELECT autor_id FROM avaliacoes_bares WHERE id='review'")).autor_id, 'customer');
  } finally { sql.close(); }
});

test('opiniões de donos permanecem visíveis e não contam nas médias do bar nem dos itens', async () => {
  const { sql, db } = database();
  try {
    await db.runAsync("INSERT INTO usuarios(id,usuario,created_at,updated_at) VALUES ('customer','Cliente','now','now')");
    const initial = bar();
    initial.avaliacoes = [{ id: 'review', autorId: 'customer', autor: 'Cliente', nota: 5, comentario: 'Anterior ao vínculo' }];
    initial.cardapio[0].avaliacoes = [{ id: 'itemreview', autorId: 'customer', autor: 'Cliente', nota: 5, comentario: 'Anterior ao vínculo' }];
    await storeCatalog(db, [initial], { newId: randomUUID });
    await db.runAsync("INSERT INTO bar_proprietarios(bar_id,usuario_id,created_at,updated_at) VALUES ('bar','customer','now','now')");
    const result = (await readCatalog(db))[0];
    assert.equal(result.avaliacoes.length, 1); assert.equal(result.cardapio[0].avaliacoes.length, 1);
    assert.equal(avaliacaoContaNoRanking(result.avaliacoes[0], result.proprietarios), false);
    assert.equal(calcularNotaMedia(result.avaliacoes, result.proprietarios), 0);
    assert.equal(calcularNotaMedia(result.cardapio[0].avaliacoes, result.proprietarios), 0);
    // A regra de exibição não altera a autoridade nem cria um envio de avaliação alheia.
    await storeCatalog(db, [result], { actorId: owner.id, enqueue: true, newId: randomUUID });
    assert.equal((await db.getAllAsync('SELECT * FROM sync_queue')).length, 0);
  } finally { sql.close(); }
});
