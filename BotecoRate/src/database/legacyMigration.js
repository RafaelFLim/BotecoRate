import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { initDatabase, writeTransaction } from './database';
import { storeCatalog } from './catalogStore';
import { hashPassword } from '../services/passwordService';

export async function migrateLegacyData() {
  const db = await initDatabase();
  if (await db.getFirstAsync("SELECT key FROM app_settings WHERE key='legacy_migrated'")) {
    // Recuperar uma interrupção que ocorreu depois do commit e antes da limpeza.
    await AsyncStorage.removeItem('@boteco_rate_usuarios');
    await AsyncStorage.removeItem('@boteco_rate_sessao');
    return;
  }
  // Erro de leitura/JSON aborta a migração; jamais substituir dados por seed.
  const usersRaw = await AsyncStorage.getItem('@boteco_rate_usuarios');
  const barsRaw = await AsyncStorage.getItem('@boteco_rate_bares');
  const users = usersRaw ? JSON.parse(usersRaw) : [];
  const bars = barsRaw ? JSON.parse(barsRaw) : [];
  if (!Array.isArray(users) || !Array.isArray(bars)) throw new Error('Dados antigos inválidos. O backup original foi preservado.');
  const accounts = [];
  for (const bar of bars) {
    for (const review of [...(bar.avaliacoes || []), ...(bar.cardapio || []).flatMap((item) => item.avaliacoes || [])]) {
      // Nome legado não comprova UID Firebase; manter a opinião sem usá-la no ranking.
      review.elegivelRanking = false;
      review.autorId = null;
    }
  }
  for (const user of users) {
    if (typeof user.usuario !== 'string' || typeof user.senha !== 'string') throw new Error('Conta antiga inválida.');
    accounts.push({ ...user, credential: await hashPassword(user.senha) });
  }
  const now = new Date().toISOString();
  await writeTransaction(async (tx) => {
    for (const u of accounts) {
      const id = `local:${u.id}`;
      await tx.runAsync("INSERT OR IGNORE INTO usuarios(id,usuario,origem,created_at,updated_at) VALUES (?,?,'local',?,?)", id, u.usuario, now, now);
      await tx.runAsync("INSERT OR IGNORE INTO contas_locais(id,usuario_normalizado,password_hash,salt,iterations,algorithm,created_at) VALUES (?,?,?,?,?,'pbkdf2-sha256',?)", id, u.usuario.trim().toLowerCase(), u.credential.hash, u.credential.salt, u.credential.iterations, now);
    }
    await storeCatalog(tx, bars, { legacy: true, newId: randomUUID });
    await tx.runAsync("INSERT INTO app_settings(key,value) VALUES ('legacy_migrated',?)", now);
  });
  // Retirar senhas em texto puro somente depois do commit. O catálogo antigo é
  // mantido como origem de recuperação, mas nunca será usado como banco ativo.
  await AsyncStorage.removeItem('@boteco_rate_usuarios');
  await AsyncStorage.removeItem('@boteco_rate_sessao');
}
