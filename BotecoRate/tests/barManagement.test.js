import { test, expect } from "@jest/globals";
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { SCHEMA_SQL } from '../src/database/schema.js';
import { readCatalog, storeCatalog, TABLES } from '../src/database/catalogStore.js';
import { validateCatalogChange } from '../src/utils/catalogRules.js';
import { prepareBarEdit, prepareBarDeletion } from '../src/utils/barManagement.js';
import { calcularNotaMedia, avaliacaoContaNoRanking } from '../src/utils/nota.js';
import { saveOwnership } from '../src/database/ownershipStore.js';
import { saveModeration } from '../src/database/moderationStore.js';
import { planModeration } from '../src/services/adminProtocol.js';
const owner = {
  id: 'owner',
  usuario: 'Dono',
  origem: 'firebase',
  emailVerificado: true,
  status: 'ativo',
  papel: 'dono',
  cadastroBarAprovado: true
};
const admin = {
  ...owner,
  id: 'admin',
  papel: 'admin'
};
const bar = () => ({
  id: 'bar',
  nome: 'Bar',
  endereco: 'Rua A',
  detalhes: 'Ambiente',
  foto: 'https://example.test/photo',
  version: 1,
  latitude: -21,
  longitude: -43,
  proprietarios: ['owner'],
  avaliacoes: [],
  cardapio: [1, 2, 3].map(n => ({
    id: `item${n}`,
    tipo: 'comida',
    nome: 'Porção',
    descricao: 'Teste',
    valor: 10,
    foto: null,
    avaliacoes: []
  }))
});
const patch = initial => ({
  ...initial,
  nome: 'Novo nome',
  endereco: 'Rua B',
  latitude: null,
  longitude: null
});
test('gestão integrada preserva opinião moderada e exclusão permanente do ranking após saída do dono', async () => {
  const {
    sql,
    db
  } = database();
  try {
    await db.runAsync("INSERT INTO usuarios(id,usuario,created_at,updated_at) VALUES ('customer','Cliente','now','now')");
    await db.runAsync("INSERT INTO usuarios(id,usuario,created_at,updated_at) VALUES ('owner','Dono','now','now'),('admin','Administrador','now','now')");
    const initial = bar();
    initial.avaliacoes = [{
      id: 'former',
      autorId: 'customer',
      autor: 'Cliente',
      nota: 5,
      comentario: 'Antes do vínculo'
    }, {
      id: 'hidden',
      autorId: 'owner',
      autor: 'Dono',
      nota: 1,
      comentario: 'Conteúdo preservado'
    }];
    await storeCatalog(db, [initial], {
      newId: randomUUID
    });
    const timestamp = '2026-10-23T12:00:00.000Z';
    const request = {
      id: 'r',
      bar_id: 'bar',
      kind: 'adicionar',
      recipient_uid: 'customer',
      created_by: 'owner',
      reason: 'Novo sócio',
      status: 'concluida',
      version: 3,
      base_version: 0,
      access_epoch: 0,
      required_order: '|owner|customer|',
      queue: '|',
      accepted_count: 2,
      created_at: timestamp,
      updated_at: timestamp,
      updated_by: 'customer',
      participants: {
        owner: 'aceito',
        customer: 'aceito'
      }
    };
    await saveOwnership(db, {
      bar: {
        r: request
      }
    });
    await saveOwnership(db, {}, {}); // A saída posterior não remove a exclusão durável.
    const moderation = planModeration(null, {
      actor: 'admin',
      table: 'avaliacoes_bares',
      id: 'hidden',
      status: 'oculta',
      reason: 'Moderação justificada',
      operationId: 'mod',
      now: timestamp
    });
    await saveModeration(db, {
      avaliacoes_bares: {
        hidden: moderation['direct/moderation/avaliacoes_bares/hidden']
      }
    });
    const current = (await readCatalog(db))[0];
    const next = prepareBarEdit([current], 'bar', patch(current), current, admin);
    validateCatalogChange([current], next, admin);
    await storeCatalog(db, next, {
      actorId: admin.id,
      enqueue: true,
      newId: randomUUID
    });
    const result = (await readCatalog(db))[0];
    expect(result.avaliacoes.length).toBe(1);
    expect(result.avaliacoes[0].bloqueadaPorPropriedade).toBe(true);
    expect(calcularNotaMedia(result.avaliacoes, result.proprietarios)).toBe(0);
    expect(sql.prepare("SELECT comentario FROM avaliacoes_bares WHERE id='hidden'").get().comentario).toBe('Conteúdo preservado');
    expect(sql.prepare("SELECT elegivel_ranking FROM avaliacoes_bares WHERE id='former'").get().elegivel_ranking).toBe(1);
    const queued = await db.getAllAsync('SELECT entity_type FROM sync_queue');
    expect(queued.map(row => row.entity_type)).toEqual(['bares']);
  } finally {
    sql.close();
  }
});
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
test('gestão permite dono vinculado e admin; rejeita comum, outro dono, local, não verificado e banido', () => {
  const initial = bar();
  for (const user of [owner, admin]) {
    expect(() => prepareBarEdit([initial], initial.id, patch(initial), initial, user)).not.toThrow();
    expect(prepareBarDeletion([initial], initial.id, initial, user)).toEqual([]);
  }
  for (const user of [null, {
    ...owner,
    id: 'other'
  }, {
    ...owner,
    papel: 'comum'
  }, {
    ...owner,
    origem: 'local'
  }, {
    ...owner,
    emailVerificado: false
  }, {
    ...admin,
    status: 'banido'
  }]) {
    expect(() => prepareBarEdit([initial], initial.id, patch(initial), initial, user)).toThrow(/permissão/);
    expect(() => prepareBarDeletion([initial], initial.id, initial, user)).toThrow(/permissão/);
  }
});
test('edição preserva cardápio, opiniões recentes, autoria e donos; rascunho não altera autoridade', () => {
  const initial = bar();
  const current = {
    ...initial,
    avaliacoes: [{
      id: 'r',
      autorId: 'customer',
      nota: 4
    }]
  };
  const next = prepareBarEdit([current], 'bar', {
    ...patch(initial),
    proprietarios: ['attacker'],
    criadoPor: 'attacker',
    cardapio: []
  }, initial, owner);
  expect(next[0].nome).toBe('Novo nome');
  expect(next[0].cardapio).toEqual(current.cardapio);
  expect(next[0].avaliacoes).toEqual(current.avaliacoes);
  expect(next[0].proprietarios).toEqual(['owner']);
  expect(next[0].criadoPor).toBe(current.criadoPor);
  expect(() => validateCatalogChange([current], next, owner)).not.toThrow();
  expect(initial.nome).toBe('Bar');
});
test('edição e exclusão rejeitam formulário desatualizado, bar removido e vínculo perdido', () => {
  const initial = bar();
  for (const current of [{
    ...initial,
    version: 2
  }, {
    ...initial,
    endereco: 'Mudou'
  }, {
    ...initial,
    foto: 'https://example.test/other'
  }]) {
    expect(() => prepareBarEdit([current], 'bar', patch(initial), initial, owner)).toThrow(/mudaram/);
    expect(() => prepareBarDeletion([current], 'bar', initial, owner)).toThrow(/mudaram/);
  }
  expect(() => prepareBarDeletion([], 'bar', initial, owner)).toThrow(/excluído/);
  expect(() => prepareBarEdit([{
    ...initial,
    proprietarios: ['other']
  }], 'bar', patch(initial), initial, owner)).toThrow(/permissão/);
});
test('regras impedem apagar dados obrigatórios, coordenadas inválidas e mudar proprietários pelo catálogo', () => {
  const initial = bar();
  for (const data of [{
    cep: '123'
  }, {
    cep: 12345678
  }, {
    nome: ' '
  }, {
    endereco: ''
  }, {
    detalhes: ''
  }, {
    foto: null
  }, {
    latitude: 91
  }, {
    longitude: null
  }, {
    longitude: Infinity
  }, {
    nome: 'a'.repeat(151)
  }]) {
    const next = {
      ...initial,
      ...data
    };
    expect(() => prepareBarEdit([initial], 'bar', next, initial, owner)).toThrow();
    expect(() => validateCatalogChange([initial], [next], owner)).toThrow();
  }
  expect(() => validateCatalogChange([initial], [{
    ...initial,
    proprietarios: ['other']
  }], owner)).toThrow(/propriedade/);
});
test('editar gera histórico e um comando; excluir gera um lote com tombstones de todos os filhos', async () => {
  const {
    sql,
    db
  } = database();
  try {
    await db.runAsync("INSERT INTO usuarios(id,usuario,created_at,updated_at) VALUES ('customer','Cliente','now','now')");
    const initial = bar();
    initial.avaliacoes = [{
      id: 'review',
      autorId: 'customer',
      autor: 'Cliente',
      nota: 4,
      comentario: 'Bom'
    }];
    initial.cardapio[0].avaliacoes = [{
      id: 'itemreview',
      autorId: 'customer',
      autor: 'Cliente',
      nota: 5,
      comentario: 'Bom'
    }];
    await storeCatalog(db, [initial], {
      newId: randomUUID
    });
    await db.runAsync("INSERT INTO usuarios(id,usuario,created_at,updated_at) VALUES ('owner','Dono','now','now')");
    await db.runAsync("INSERT INTO bar_proprietarios(bar_id,usuario_id,created_at,updated_at) VALUES ('bar','owner','now','now')");
    let current = (await readCatalog(db))[0];
    const next = prepareBarEdit([current], 'bar', patch(current), current, owner);
    validateCatalogChange([current], next, owner);
    await storeCatalog(db, next, {
      actorId: owner.id,
      enqueue: true,
      newId: randomUUID
    });
    expect((await db.getAllAsync('SELECT * FROM sync_queue')).length).toBe(1);
    const history = await db.getFirstAsync("SELECT * FROM bares_historico WHERE acao='update'");
    expect(JSON.parse(history.snapshot_json).nome).toBe('Bar');
    // Simula a confirmação da edição antes de testar o próximo lote offline.
    await db.runAsync('DELETE FROM sync_queue');
    await db.runAsync('DELETE FROM sync_batches');
    current = (await readCatalog(db))[0];
    const removed = prepareBarDeletion([current], 'bar', current, owner);
    validateCatalogChange([current], removed, owner);
    await storeCatalog(db, removed, {
      actorId: owner.id,
      enqueue: true,
      newId: randomUUID
    });
    expect((await readCatalog(db)).length).toBe(0);
    const batches = await db.getAllAsync('SELECT * FROM sync_batches');
    const changes = JSON.parse(batches[0].payload).changes;
    expect(batches.length).toBe(1);
    expect(changes.length).toBe(6);
    expect(changes.every(change => change.operation === 'soft_delete')).toBeTruthy();
    for (const table of TABLES) expect((await db.getAllAsync(`SELECT * FROM ${table} WHERE deleted_at IS NULL`)).length).toBe(0);
    expect((await db.getFirstAsync("SELECT autor_id FROM avaliacoes_bares WHERE id='review'")).autor_id).toBe('customer');
  } finally {
    sql.close();
  }
});
test('opiniões de donos permanecem visíveis e não contam nas médias do bar nem dos itens', async () => {
  const {
    sql,
    db
  } = database();
  try {
    await db.runAsync("INSERT INTO usuarios(id,usuario,created_at,updated_at) VALUES ('customer','Cliente','now','now')");
    const initial = bar();
    initial.avaliacoes = [{
      id: 'review',
      autorId: 'customer',
      autor: 'Cliente',
      nota: 5,
      comentario: 'Anterior ao vínculo'
    }];
    initial.cardapio[0].avaliacoes = [{
      id: 'itemreview',
      autorId: 'customer',
      autor: 'Cliente',
      nota: 5,
      comentario: 'Anterior ao vínculo'
    }];
    await storeCatalog(db, [initial], {
      newId: randomUUID
    });
    await db.runAsync("INSERT INTO bar_proprietarios(bar_id,usuario_id,created_at,updated_at) VALUES ('bar','customer','now','now')");
    const result = (await readCatalog(db))[0];
    expect(result.avaliacoes.length).toBe(1);
    expect(result.cardapio[0].avaliacoes.length).toBe(1);
    expect(avaliacaoContaNoRanking(result.avaliacoes[0], result.proprietarios)).toBe(false);
    expect(calcularNotaMedia(result.avaliacoes, result.proprietarios)).toBe(0);
    expect(calcularNotaMedia(result.cardapio[0].avaliacoes, result.proprietarios)).toBe(0);
    // A regra de exibição não altera a autoridade nem cria um envio de avaliação alheia.
    await storeCatalog(db, [result], {
      actorId: owner.id,
      enqueue: true,
      newId: randomUUID
    });
    expect((await db.getAllAsync('SELECT * FROM sync_queue')).length).toBe(0);
  } finally {
    sql.close();
  }
});
