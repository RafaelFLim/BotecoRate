import test from 'node:test';
import assert from 'node:assert/strict';
import { attachHistoryContexts, matchesHistoryContext, orderHistory } from '../src/utils/historyFilters.js';
import { paginate } from '../src/utils/pagination.js';

test('paginação limita resultados, respeita limites vazios e corrige página após redução da lista', () => {
  const items = Array.from({ length: 43 }, (_, id) => ({ id }));
  assert.equal(paginate(items).items.length, 20);
  assert.deepEqual(paginate(items, 3).items.map(x => x.id), [40, 41, 42]);
  assert.equal(paginate(items, 999).page, 3);
  assert.equal(paginate(items.slice(0, 2), 3).page, 1);
  assert.deepEqual(paginate([], 5), { items: [], page: 1, pages: 1, total: 0, first: 0, last: 0 });
  assert.equal(paginate(items, -1).first, 1);
  assert.equal(items.length, 43);
});

const fixture = () => ({
  entities: { bares: { a: { nome: 'Bar Atual', endereco: 'Rua Nova', cep: '01001000', deleted_at: 'hoje' }, b: { nome: 'Outro Bar', endereco: 'Rua sem CEP' } }, itens_cardapio: { item: { bar_id: 'a' } } },
  owners: { a: { atual: true } },
  history: { bares: { a: { 2: { before: { nome: 'Bar Antigo', endereco: 'Praça da Sé', cep: '02002000' }, record: { nome: 'Bar Atual', endereco: 'Rua Nova', cep: '01001000' } } } }, itens_cardapio: { removed: { 1: { record: { bar_id: 'a' } } } } },
  ownership_history: { a: { done: { 4: { record: { status: 'concluida', required_order: '|anterior|atual|' } } }, waiting: { 1: { record: { status: 'pendente', required_order: '|atual|convidado|' } } } } },
});

test('filtros combinam bar, dono e endereço anteriores sem confundir autor ou convidado com dono', () => {
  const direct = fixture(), snapshot = JSON.stringify(direct);
  const events = attachHistoryContexts([{ entity_type: 'avaliacoes_itens', entity_id: 'review', actor_uid: 'moderador', record: { item_id: 'removed' } }], direct);
  const event = events[0], users = [{ uid: 'anterior', name: 'João' }];
  assert.equal(matchesHistoryContext(event, { bar: 'antigo', owner: 'joao', address: 'praca da se', cep: '01001-000' }, users), true);
  assert.equal(matchesHistoryContext(event, { owner: 'moderador' }), false);
  assert.equal(matchesHistoryContext(event, { owner: 'convidado' }), false);
  assert.equal(matchesHistoryContext(event, { bar: 'Outro Bar', cep: '01001000' }), false);
  assert.equal(matchesHistoryContext(event, { cep: '02002000' }), true);
  assert.equal(JSON.stringify(direct), snapshot);
});

test('CEP exato não é deduzido de endereço e eventos de contas não recebem contexto de bar', () => {
  const direct = fixture();
  direct.entities.bares.b.endereco = 'Mesmo nome de rua - 01001-000';
  const [bar, user] = attachHistoryContexts([{ entity_type: 'bares', entity_id: 'b', record: {} }, { entity_type: 'usuarios', entity_id: 'a', record: {} }], direct);
  assert.equal(matchesHistoryContext(bar, { cep: '01001000' }), false);
  assert.equal(matchesHistoryContext(bar, { withoutCep: true }), true);
  assert.equal(matchesHistoryContext(bar, { cep: '01001' }), false);
  assert.equal(user.bar_context, null);
});

test('ordenar e paginar depois dos filtros não perde eventos com a mesma data', () => {
  const events = Array.from({ length: 45 }, (_, id) => ({ entity_type: 'bares', entity_id: String(id).padStart(2, '0'), record: { version: 1, updated_at: '2026-10-29' } }));
  const first = orderHistory(events), reversed = orderHistory([...events].reverse());
  assert.deepEqual(first, reversed);
  const all = [1, 2, 3].flatMap(page => paginate(first, page).items);
  assert.equal(new Set(all.map(e => e.entity_id)).size, 45);
});
