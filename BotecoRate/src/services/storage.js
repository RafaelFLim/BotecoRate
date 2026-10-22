import { randomUUID } from 'expo-crypto';
import { writeTransaction } from '../database/database';
import { readCatalog, storeCatalog } from '../database/catalogStore';
import { getActiveUser } from './authService';
import { validateCatalogChange } from '../utils/catalogRules';

const listeners = new Set();
export const subscribeCatalog = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export function notifyCatalog() { for (const fn of listeners) fn(); }

export async function carregarBares() { return writeTransaction(readCatalog); }

export async function salvarBares(listaDeBares) {
  return alterarBares(() => listaDeBares);
}

export async function alterarBares(transform) {
  const user = getActiveUser();
  await writeTransaction(async (tx) => {
    const old = await readCatalog(tx);
    const listaDeBares = transform(old);
    validateCatalogChange(old, listaDeBares, user);
    await storeCatalog(tx, listaDeBares, { actorId: user.id, enqueue: true, newId: randomUUID });
    for (const bar of listaDeBares) if (!old.some((b) => b.id === bar.id)) {
      const now = new Date().toISOString();
      await tx.runAsync('INSERT INTO bar_proprietarios(bar_id,usuario_id,created_at,updated_at) VALUES (?,?,?,?)', bar.id, user.id, now, now);
    }
  });
  notifyCatalog();
}
