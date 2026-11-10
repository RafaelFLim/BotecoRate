import { test, expect } from "@jest/globals";
import { listTrashEntries } from '../src/services/trashEntries.js';
const deleted_at = '2026-10-22T12:00:00.000Z';
const row = {
  deleted_at,
  version: 2
};
const event = actor_uid => ({
  actor_uid,
  operation: 'soft_delete',
  record: row
});
const direct = {
  entities: {
    bares: {
      bar: {
        ...row,
        nome: 'Bar',
        criado_por: 'alice'
      },
      legado: row
    },
    itens_cardapio: {
      item: {
        ...row,
        nome: 'Item',
        bar_id: 'bar'
      }
    },
    avaliacoes_bares: {
      review: {
        autor_id: 'alice',
        bar_id: 'bar'
      }
    }
  },
  history: {
    bares: {
      bar: {
        2: event('bob')
      }
    },
    itens_cardapio: {
      item: {
        2: event('alice')
      }
    }
  },
  moderation: {
    avaliacoes_bares: {
      review: {
        status: 'excluida',
        deleted_at,
        updated_by: 'admin'
      }
    }
  },
  owners: {
    bar: {
      alice: true
    }
  }
};
test('lixeira pessoal usa quem excluiu e preserva a restrição da moderação', () => {
  expect(listTrashEntries({
    direct,
    actor: 'alice',
    admin: false
  }).map(entry => entry.id)).toEqual(['item']);
  expect(listTrashEntries({
    direct,
    actor: 'bob',
    admin: false
  }).map(entry => entry.id)).toEqual(['bar']);
  expect(listTrashEntries({
    direct,
    actor: 'admin',
    admin: false
  })).toEqual([]);
});
test('admin vê todos os tipos e encontra o responsável, inclusive quando ele próprio excluiu', () => {
  const entries = listTrashEntries({
    direct,
    actor: 'admin',
    admin: true,
    accounts: {
      carol: {
        status: 'excluido',
        deleted_at,
        updated_by: 'admin',
        purge_after: 123
      }
    },
    directory: {
      admin: {
        name: 'Rafael'
      }
    }
  });
  expect(entries.map(entry => entry.id).sort()).toEqual(['bar', 'carol', 'item', 'legado', 'review']);
  const review = entries.find(entry => entry.id === 'review');
  expect(review.deletedByName).toBe('Rafael');
  expect(review.restoreAction).toBe('visivel');
  expect(entries.find(entry => entry.id === 'carol').deadline).toBe(123);
  expect(entries.find(entry => entry.id === 'legado').deletedBy).toBe(null);
});
