import NetInfo from '@react-native-community/netinfo';
import { get, ref } from 'firebase/database';
import { randomUUID } from 'expo-crypto';
import { db as remote, firebaseConfigured } from './firebaseConfig';
import { initDatabase, writeTransaction } from '../database/database';
import { readCatalog, storeCatalog } from '../database/catalogStore';
import { notifyCatalog } from './storage';

let running;
export function syncCatalog() {
  if (!running) running = synchronize().finally(() => { running = null; });
  return running;
}

async function synchronize() {
  const state = await NetInfo.fetch();
  if (!state.isConnected || state.isInternetReachable === false) return 'Offline — usando o catálogo deste aparelho';
  if (!firebaseConfigured) return 'Consulta local — Firebase ainda não configurado';
  const db = await initDatabase();
  const queue = await db.getFirstAsync('SELECT COUNT(*) AS total FROM sync_queue');
  // Nesta etapa, escrita remota está fechada até o protocolo de autorização
  // Flask estar instalado. Nunca enviar snapshots sem validação de versão.
  if (queue.total > 0) return `${queue.total} alterações locais aguardando a API de sincronização`;
  const snapshot = await get(ref(remote, 'v1/catalog'));
  if (!snapshot.exists()) return 'Catálogo remoto ainda não publicado';
  const data = snapshot.val();
  if (!data || !Array.isArray(data.bares) || !Number.isInteger(data.version)) throw new Error('Catálogo remoto inválido.');
  await writeTransaction(async (tx) => {
    const pending = await tx.getFirstAsync('SELECT COUNT(*) AS total FROM sync_queue');
    if (pending.total > 0) throw new Error('Há alterações locais pendentes. O catálogo não foi sobrescrito.');
    const savedVersion = await tx.getFirstAsync("SELECT value FROM app_settings WHERE key='catalog_version'");
    if (Number(savedVersion?.value || 0) >= data.version) return;
    // A projeção pública contém apenas nomes, endereços e coordenadas. Não
    // substituir detalhes/avaliações já existentes ao receber a projeção.
    const current = await readCatalog(tx);
    const merged = current.filter((bar) => !data.bares.some((b) => b.id === bar.id));
    for (const bar of data.bares) {
      if (!bar.id || !bar.nome || !bar.endereco) throw new Error('Bar remoto inválido.');
      const old = current.find((b) => b.id === bar.id);
      if (bar.deleted_at) continue;
      merged.push({ ...old, id: bar.id, nome: bar.nome, endereco: bar.endereco,
        foto: bar.foto || old?.foto || null, latitude: bar.latitude ?? null, longitude: bar.longitude ?? null,
        detalhes: old?.detalhes || '', cardapio: old?.cardapio || [], avaliacoes: old?.avaliacoes || [] });
    }
    await storeCatalog(tx, merged, { newId: randomUUID });
    await tx.runAsync("INSERT INTO app_settings(key,value) VALUES ('catalog_version',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", String(data.version));
  });
  notifyCatalog();
  return 'Catálogo de endereços atualizado';
}
