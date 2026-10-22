import * as SQLite from 'expo-sqlite';
import { SCHEMA_SQL, SCHEMA_VERSION } from './schema';

let connection;
let ready;
let writeChain = Promise.resolve();

export async function getDatabase() {
  if (!connection) connection = SQLite.openDatabaseAsync('botecorate.db');
  return connection;
}

export async function initDatabase() {
  if (!ready) ready = (async () => {
    const db = await getDatabase();
    await db.execAsync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
    const version = await db.getFirstAsync('PRAGMA user_version');
    if (version.user_version > SCHEMA_VERSION) throw new Error('Este banco exige uma versão mais recente do aplicativo.');
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.execAsync(SCHEMA_SQL);
      await tx.runAsync('INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES (?,?)', SCHEMA_VERSION, new Date().toISOString());
      await tx.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    });
    return db;
  })().catch((error) => { ready = null; throw error; });
  return ready;
}

// Uma escrita por vez: alteração, histórico e fila sempre no mesmo commit.
export function writeTransaction(work) {
  const operation = writeChain.then(async () => {
    const db = await initDatabase();
    let result;
    await db.withExclusiveTransactionAsync(async (tx) => { result = await work(tx); });
    return result;
  });
  writeChain = operation.catch(() => {});
  return operation;
}
