import { test, expect } from "@jest/globals";
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
  sql.exec('PRAGMA foreign_keys=ON;');
  sql.exec(SCHEMA_SQL);
  const db = {
    getAllAsync: async (query, ...params) => sql.prepare(query).all(...params),
    getFirstAsync: async (query, ...params) => sql.prepare(query).get(...params),
    runAsync: async (query, ...params) => sql.prepare(query).run(...params)
  };
  return {
    sql,
    db
  };
}
const bar = () => ({
  id: 'bar',
  nome: 'Bar de teste',
  endereco: 'Rua A, 10',
  detalhes: 'Teste',
  foto: 'file://foto.jpg',
  latitude: null,
  longitude: null,
  proprietarios: ['dono'],
  avaliacoes: [],
  cardapio: [1, 2, 3].map(n => ({
    id: 'item' + n,
    tipo: 'comida',
    nome: 'Item ' + n,
    descricao: 'Porção',
    valor: 12.35,
    foto: null,
    avaliacoes: []
  }))
});
const common = {
  id: 'cliente',
  usuario: 'Cliente',
  origem: 'firebase',
  emailVerificado: true,
  status: 'ativo',
  papel: 'comum'
};
const owner = {
  ...common,
  id: 'dono',
  papel: 'dono',
  cadastroBarAprovado: true
};
const options = {
  actorId: null,
  newId: randomUUID
};
test('catálogo normalizado preserva centavos, datas legadas e histórico', async () => {
  const {
    sql,
    db
  } = database();
  const original = bar();
  original.cardapio[0].criadoEm = '2026-08-01T12:00:00.000Z';
  original.cardapio[0].historico = [{
    nome: 'Anterior',
    valor: 10,
    data: '2026-07-01T12:00:00.000Z'
  }];
  await storeCatalog(db, [original], {
    ...options,
    legacy: true
  });
  expect((await readCatalog(db))[0].cardapio.find(i => i.id === 'item1').valor).toBe(12.35);
  expect(sql.prepare('SELECT created_at FROM itens_cardapio WHERE id=?').get('item1').created_at).toBe(original.cardapio[0].criadoEm);
  expect((await readCatalog(db))[0].cardapio.find(i => i.id === 'item1').historico[0].valor).toBe(10);
  const updated = await readCatalog(db);
  updated[0].cardapio.find(i => i.id === 'item1').valor = 15;
  await storeCatalog(db, updated, options);
  const history = (await readCatalog(db))[0].cardapio.find(i => i.id === 'item1').historico;
  expect(history.at(-1).valor).toBe(12.35);
  sql.close();
});
test('exclusão é lógica e repetição sem mudanças não duplica histórico', async () => {
  const {
    sql,
    db
  } = database();
  await storeCatalog(db, [bar()], options);
  const before = sql.prepare('SELECT COUNT(*) AS n FROM bares_historico').get().n;
  await storeCatalog(db, await readCatalog(db), options);
  expect(sql.prepare('SELECT COUNT(*) AS n FROM bares_historico').get().n).toBe(before);
  await storeCatalog(db, [], options);
  expect((await readCatalog(db)).length).toBe(0);
  expect(sql.prepare('SELECT deleted_at FROM bares WHERE id=?').get('bar').deleted_at).toBeTruthy();
  expect(sql.prepare('SELECT COUNT(*) AS n FROM itens_cardapio WHERE deleted_at IS NOT NULL').get().n).toBe(3);
  sql.close();
});
test('SQLite impõe FK, preço inteiro, nota inteira, par de coordenadas e avaliação única', () => {
  const {
    sql
  } = database();
  const now = '2026-10-22';
  sql.prepare('INSERT INTO usuarios(id,usuario,created_at,updated_at) VALUES (?,?,?,?)').run('u', 'Nome', now, now);
  sql.prepare('INSERT INTO bares(id,nome,endereco,created_at,updated_at) VALUES (?,?,?,?,?)').run('b', 'Bar', 'Rua', now, now);
  expect(() => sql.prepare('INSERT INTO bares(id,nome,endereco,latitude,created_at,updated_at) VALUES (?,?,?,?,?,?)').run('bad', 'Bar', 'Rua', 10, now, now)).toThrow();
  expect(() => sql.prepare('INSERT INTO itens_cardapio(id,bar_id,tipo,nome,descricao,valor_centavos,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').run('i', 'missing', 'comida', 'Item', 'Texto', 100, now, now)).toThrow();
  expect(() => sql.prepare('INSERT INTO itens_cardapio(id,bar_id,tipo,nome,descricao,valor_centavos,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').run('i', 'b', 'comida', 'Item', 'Texto', 1.5, now, now)).toThrow();
  const query = 'INSERT INTO avaliacoes_bares(id,bar_id,autor_id,autor_nome,nota,comentario,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)';
  sql.prepare(query).run('r', 'b', 'u', 'Nome', 5, 'Bom', now, now);
  expect(() => sql.prepare(query).run('r2', 'b', 'u', 'Nome', 4, 'Duplicada', now, now)).toThrow();
  expect(() => sql.prepare(query).run('r3', 'b', null, 'Nome', 2.5, 'Nota inválida', now, now)).toThrow();
  sql.close();
});
test('falha de gravação reverte também histórico e fila', async () => {
  const {
    sql,
    db
  } = database();
  sql.exec('BEGIN');
  try {
    const invalid = bar();
    invalid.cardapio[2].valor = -1;
    await expect(storeCatalog(db, [invalid], options)).rejects.toThrow();
  } finally {
    sql.exec('ROLLBACK');
  }
  expect(sql.prepare('SELECT COUNT(*) AS n FROM bares').get().n).toBe(0);
  expect(sql.prepare('SELECT COUNT(*) AS n FROM bares_historico').get().n).toBe(0);
  expect(sql.prepare('SELECT COUNT(*) AS n FROM sync_queue').get().n).toBe(0);
  sql.close();
});
test('permissões: local/não verificado não escreve; comum não cadastra; dono não se avalia', () => {
  expect(() => validateCatalogChange([], [bar()], {
    ...owner,
    origem: 'local'
  })).toThrow();
  expect(() => validateCatalogChange([], [bar()], {
    ...owner,
    emailVerificado: false
  })).toThrow();
  expect(() => validateCatalogChange([], [bar()], common)).toThrow();
  expect(() => validateCatalogChange([], [bar()], owner)).not.toThrow();
  const old = bar(),
    next = bar();
  next.avaliacoes = [{
    id: 'r',
    autorId: 'dono',
    autor: 'Dono',
    nota: 5,
    comentario: 'Bom'
  }];
  expect(() => validateCatalogChange([old], [next], owner)).toThrow();
  const less = bar();
  less.cardapio.pop();
  expect(() => validateCatalogChange([old], [less], owner)).toThrow();
});
test('fila e histórico são criados junto com a alteração e ranking ignora inelegíveis', async () => {
  const {
    sql,
    db
  } = database();
  await storeCatalog(db, [bar()], {
    ...options,
    actorId: 'uid',
    enqueue: true
  });
  expect(sql.prepare('SELECT COUNT(*) AS n FROM sync_queue').get().n).toBe(4);
  expect(calcularNotaMedia([{
    nota: 5,
    elegivelRanking: false
  }, {
    nota: 3
  }])).toBe(3);
  expect(calcularNotaMedia([{
    nota: 5,
    elegivelRanking: false
  }])).toBe(0);
  sql.close();
});
test('opinião de cliente verificado é permitida; editar opinião alheia e forjar ranking não', () => {
  const before = bar(),
    after = bar();
  after.avaliacoes = [{
    id: 'r',
    autorId: common.id,
    autor: common.usuario,
    nota: 4,
    comentario: 'Bom',
    elegivelRanking: true
  }];
  expect(() => validateCatalogChange([before], [after], common)).not.toThrow();
  const tampered = structuredClone(after);
  tampered.avaliacoes[0].comentario = 'Alterado';
  expect(() => validateCatalogChange([after], [tampered], {
    ...common,
    id: 'outro'
  })).toThrow();
  tampered.avaliacoes[0].comentario = 'Bom';
  tampered.avaliacoes[0].elegivelRanking = false;
  expect(() => validateCatalogChange([after], [tampered], common)).toThrow();
});
test('hash de senha usa PBKDF2 interoperável com salt e aceita caracteres Unicode', async () => {
  const salt = '1234567890abcdef1234567890abcdef';
  const password = 'Sênha!😀';
  const derived = await derivePassword(password, salt, 600000);
  expect(derived).toBe(pbkdf2Sync(password, Buffer.from(salt, 'hex'), 600000, 32, 'sha256').toString('hex'));
  expect(equalHash(derived, derived)).toBeTruthy();
  expect(!equalHash(derived, '0'.repeat(64))).toBeTruthy();
  expect(!equalHash(derived, derived.slice(1))).toBeTruthy();
});
