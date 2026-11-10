import { test, expect } from "@jest/globals";
import { attachHistoryContexts, matchesHistoryContext, orderHistory } from '../src/utils/historyFilters.js';
import { paginate } from '../src/utils/pagination.js';
test('paginação limita resultados, respeita limites vazios e corrige página após redução da lista', () => {
  const items = Array.from({
    length: 43
  }, (_, id) => ({
    id
  }));
  expect(paginate(items).items.length).toBe(20);
  expect(paginate(items, 3).items.map(x => x.id)).toEqual([40, 41, 42]);
  expect(paginate(items, 999).page).toBe(3);
  expect(paginate(items.slice(0, 2), 3).page).toBe(1);
  expect(paginate([], 5)).toEqual({
    items: [],
    page: 1,
    pages: 1,
    total: 0,
    first: 0,
    last: 0
  });
  expect(paginate(items, -1).first).toBe(1);
  expect(items.length).toBe(43);
});
const fixture = () => ({
  entities: {
    bares: {
      a: {
        nome: 'Bar Atual',
        endereco: 'Rua Nova',
        cep: '01001000',
        deleted_at: 'hoje'
      },
      b: {
        nome: 'Outro Bar',
        endereco: 'Rua sem CEP'
      }
    },
    itens_cardapio: {
      item: {
        bar_id: 'a'
      }
    }
  },
  owners: {
    a: {
      atual: true
    }
  },
  history: {
    bares: {
      a: {
        2: {
          before: {
            nome: 'Bar Antigo',
            endereco: 'Praça da Sé',
            cep: '02002000'
          },
          record: {
            nome: 'Bar Atual',
            endereco: 'Rua Nova',
            cep: '01001000'
          }
        }
      }
    },
    itens_cardapio: {
      removed: {
        1: {
          record: {
            bar_id: 'a'
          }
        }
      }
    }
  },
  ownership_history: {
    a: {
      done: {
        4: {
          record: {
            status: 'concluida',
            required_order: '|anterior|atual|'
          }
        }
      },
      waiting: {
        1: {
          record: {
            status: 'pendente',
            required_order: '|atual|convidado|'
          }
        }
      }
    }
  }
});
test('filtros combinam bar, dono e endereço anteriores sem confundir autor ou convidado com dono', () => {
  const direct = fixture(),
    snapshot = JSON.stringify(direct);
  const events = attachHistoryContexts([{
    entity_type: 'avaliacoes_itens',
    entity_id: 'review',
    actor_uid: 'moderador',
    record: {
      item_id: 'removed'
    }
  }], direct);
  const event = events[0],
    users = [{
      uid: 'anterior',
      name: 'João'
    }];
  expect(matchesHistoryContext(event, {
    bar: 'antigo',
    owner: 'joao',
    address: 'praca da se',
    cep: '01001-000'
  }, users)).toBe(true);
  expect(matchesHistoryContext(event, {
    owner: 'moderador'
  })).toBe(false);
  expect(matchesHistoryContext(event, {
    owner: 'convidado'
  })).toBe(false);
  expect(matchesHistoryContext(event, {
    bar: 'Outro Bar',
    cep: '01001000'
  })).toBe(false);
  expect(matchesHistoryContext(event, {
    cep: '02002000'
  })).toBe(true);
  expect(JSON.stringify(direct)).toBe(snapshot);
});
test('CEP exato não é deduzido de endereço e eventos de contas não recebem contexto de bar', () => {
  const direct = fixture();
  direct.entities.bares.b.endereco = 'Mesmo nome de rua - 01001-000';
  const [bar, user] = attachHistoryContexts([{
    entity_type: 'bares',
    entity_id: 'b',
    record: {}
  }, {
    entity_type: 'usuarios',
    entity_id: 'a',
    record: {}
  }], direct);
  expect(matchesHistoryContext(bar, {
    cep: '01001000'
  })).toBe(false);
  expect(matchesHistoryContext(bar, {
    withoutCep: true
  })).toBe(true);
  expect(matchesHistoryContext(bar, {
    cep: '01001'
  })).toBe(false);
  expect(user.bar_context).toBe(null);
});
test('ordenar e paginar depois dos filtros não perde eventos com a mesma data', () => {
  const events = Array.from({
    length: 45
  }, (_, id) => ({
    entity_type: 'bares',
    entity_id: String(id).padStart(2, '0'),
    record: {
      version: 1,
      updated_at: '2026-10-29'
    }
  }));
  const first = orderHistory(events),
    reversed = orderHistory([...events].reverse());
  expect(first).toEqual(reversed);
  const all = [1, 2, 3].flatMap(page => paginate(first, page).items);
  expect(new Set(all.map(e => e.entity_id)).size).toBe(45);
});
