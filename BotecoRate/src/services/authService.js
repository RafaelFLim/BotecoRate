import { randomUUID } from 'expo-crypto';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification,
  sendPasswordResetEmail, signOut, updateProfile, updatePassword, EmailAuthProvider,
  reauthenticateWithCredential, onAuthStateChanged, reload, getIdToken } from 'firebase/auth';
import { get, ref, update } from 'firebase/database';
import { auth, db as remote, requireFirebase } from './firebaseConfig';
import { initDatabase, writeTransaction } from '../database/database';
import { hashPassword, verifyPassword } from './passwordService';
import { validarSenha } from '../utils/senha';

let activeUser = null;
const listeners = new Set();
export const getActiveUser = () => activeUser;
export const subscribeSession = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
function publish(user) { activeUser = user; for (const fn of listeners) fn(user); return user; }
const viewUser = (u) => ({ id: u.id, usuario: u.usuario, email: u.email, origem: u.origem,
  papel: u.papel, status: u.status, emailVerificado: Boolean(u.email_verificado) });

export function friendlyAuthError(error) {
  const messages = {
    'auth/invalid-credential': 'E-mail ou senha inválidos.',
    'auth/email-already-in-use': 'Este e-mail já tem conta. Entre ou recupere a senha.',
    'auth/network-request-failed': 'Sem conexão com o Firebase. Tente novamente quando houver internet.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde antes de tentar de novo.',
    'auth/invalid-email': 'Informe um e-mail válido.',
    'auth/weak-password': 'A senha não atende aos requisitos do Firebase.',
  };
  return messages[error.code] || error.message || 'Não foi possível concluir esta operação.';
}

export async function createLocalAccount(username, password) {
  const name = username.trim();
  const problem = validarSenha(password);
  if (!name || problem) throw new Error(problem || 'Informe seu nome de usuário.');
  const credential = await hashPassword(password);
  const id = `local:${randomUUID()}`;
  const now = new Date().toISOString();
  await writeTransaction(async (tx) => {
    if (await tx.getFirstAsync('SELECT id FROM contas_locais WHERE usuario_normalizado=?', name.toLowerCase())) throw new Error('Este usuário já existe neste aparelho.');
    await tx.runAsync("INSERT INTO usuarios(id,usuario,origem,created_at,updated_at) VALUES (?,?,'local',?,?)", id, name, now, now);
    await tx.runAsync("INSERT INTO contas_locais(id,usuario_normalizado,password_hash,salt,iterations,algorithm,created_at) VALUES (?,?,?,?,?,'pbkdf2-sha256',?)", id, name.toLowerCase(), credential.hash, credential.salt, credential.iterations, now);
  });
  return id;
}

export async function loginLocal(username, password) {
  const db = await initDatabase();
  const account = await db.getFirstAsync('SELECT * FROM contas_locais WHERE usuario_normalizado=? AND deleted_at IS NULL AND firebase_uid IS NULL', username.trim().toLowerCase());
  if (!account || !(await verifyPassword(password, account))) throw new Error('Usuário ou senha local inválidos.');
  const user = await db.getFirstAsync('SELECT * FROM usuarios WHERE id=? AND deleted_at IS NULL', account.id);
  if (!user || user.status !== 'ativo') throw new Error('Esta conta não está ativa.');
  return publish(viewUser(user));
}

async function waitForAuth() {
  requireFirebase();
  await new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, () => { unsubscribe(); resolve(); });
  });
}

async function cacheFirebaseUser(user, { online = true } = {}) {
  const local = await initDatabase();
  let previous = await local.getFirstAsync('SELECT * FROM usuarios WHERE id=?', user.uid);
  let role = previous?.papel || 'comum';
  let status = previous?.status || 'ativo';
  let name = previous?.usuario || user.displayName || user.email.split('@')[0];
  if (online) {
    const access = (await get(ref(remote, `v1/access_control/${user.uid}`))).val();
    const profile = (await get(ref(remote, `v1/public_profiles/${user.uid}`))).val();
    role = access?.role || 'comum'; status = access?.status || 'ativo';
    name = profile?.name || user.displayName || name;
  }
  if (status !== 'ativo') throw new Error('Sua conta está suspensa ou excluída. Entre em contato com a administração.');
  const now = new Date().toISOString();
  await writeTransaction(async (tx) => {
    await tx.runAsync(`INSERT INTO usuarios(id,usuario,email,origem,papel,status,email_verificado,created_at,updated_at)
      VALUES (?,?,?,'firebase',?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET usuario=excluded.usuario,email=excluded.email,papel=excluded.papel,status=excluded.status,email_verificado=excluded.email_verificado,updated_at=excluded.updated_at`,
    user.uid, name, user.email, role, status, user.emailVerified ? 1 : 0, previous?.created_at || now, now);
  });
  previous = await local.getFirstAsync('SELECT * FROM usuarios WHERE id=?', user.uid);
  return viewUser(previous);
}

export async function loginFirebase(email, password) {
  requireFirebase();
  const { user } = await signInWithEmailAndPassword(auth, email.trim(), password);
  try { return publish(await cacheFirebaseUser(user)); }
  catch (error) { await signOut(auth); throw error; }
}

export async function registerFirebase(name, email, password) {
  requireFirebase();
  const problem = validarSenha(password);
  if (!name.trim() || problem) throw new Error(problem || 'Informe seu nome.');
  const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);
  // Uma falha no envio não apaga a conta criada; o perfil permite reenviar.
  await updateProfile(user, { displayName: name.trim() });
  const session = await cacheFirebaseUser(user);
  publish(session);
  try {
    await sendEmailVerification(user);
    return { ...session, verificationSent: true };
  } catch {
    // O cadastro já foi confirmado: não induzir uma segunda criação da conta.
    return { ...session, verificationSent: false };
  }
}

export async function refreshSession() {
  await waitForAuth();
  if (!auth.currentUser) throw new Error('Entre novamente na sua conta.');
  await reload(auth.currentUser);
  await getIdToken(auth.currentUser, true);
  return publish(await cacheFirebaseUser(auth.currentUser));
}
export async function biometricCandidate() {
  if (!auth) return null;
  await waitForAuth();
  if (!auth.currentUser) return null;
  return cacheFirebaseUser(auth.currentUser, { online: false });
}
export async function unlockPersistedSession() {
  if (!auth?.currentUser) throw new Error('Entre com e-mail e senha primeiro.');
  // Offline permite usar apenas a autoridade anteriormente conhecida no aparelho.
  const NetInfo = (await import('@react-native-community/netinfo')).default;
  const state = await NetInfo.fetch();
  if (state.isConnected && state.isInternetReachable !== false) return refreshSession();
  return publish(await cacheFirebaseUser(auth.currentUser, { online: false }));
}
export async function activateLocalAccount(email, password, existing = false) {
  const local = activeUser;
  if (!local || local.origem !== 'local') throw new Error('Entre na conta local antes de ativar.');
  const session = existing ? await loginFirebase(email, password) : await registerFirebase(local.usuario, email, password);
  await writeTransaction(async (tx) => {
    await tx.runAsync('INSERT INTO ativacoes_conta(local_id,firebase_uid,created_at) VALUES (?,?,?)', local.id, session.id, new Date().toISOString());
    // Credenciais provisórias não devem sobreviver à ativação como senha antiga.
    await tx.runAsync('DELETE FROM contas_locais WHERE id=?', local.id);
  });
  return session;
}
export async function changeProfileName(name) {
  if (!activeUser || !name.trim()) throw new Error('Informe seu nome.');
  const user = activeUser;
  if (user.origem === 'firebase') {
    requireFirebase();
    if (!auth.currentUser?.emailVerified) throw new Error('Verifique seu e-mail primeiro.');
    const profile = (await get(ref(remote, 'v1/public_profiles/' + user.id))).val();
    const version = (profile?.version || 0) + 1;
    const changedAt = new Date().toISOString();
    // Regras comparam versão e exigem snapshot imutável no mesmo commit.
    await update(ref(remote, 'v1'), {
      ['public_profiles/' + user.id]: { name: name.trim(), version, updated_at: changedAt },
      ['profile_history/' + user.id + '/' + version]: { name: profile?.name || user.usuario, date: changedAt },
    });
    await updateProfile(auth.currentUser, { displayName: name.trim() });
  }
  const now = new Date().toISOString();
  await writeTransaction(async (tx) => {
    await tx.runAsync('INSERT INTO usuarios_historico(id,usuario_id,actor_id,acao,snapshot_json,created_at) VALUES (?,?,?,?,?,?)', randomUUID(), user.id, user.id, 'update', JSON.stringify({ usuario: user.usuario }), now);
    await tx.runAsync('UPDATE usuarios SET usuario=?,updated_at=?,version=version+1 WHERE id=?', name.trim(), now, user.id);
  });
  return publish({ ...user, usuario: name.trim() });
}
export async function changePassword(current, password) {
  const problem = validarSenha(password);
  if (problem) throw new Error(problem);
  if (!activeUser) throw new Error('Entre novamente.');
  if (activeUser.origem === 'local') {
    const db = await initDatabase();
    const account = await db.getFirstAsync('SELECT * FROM contas_locais WHERE id=?', activeUser.id);
    if (!(await verifyPassword(current, account))) throw new Error('Senha atual incorreta.');
    const c = await hashPassword(password);
    await writeTransaction((tx) => tx.runAsync('UPDATE contas_locais SET password_hash=?,salt=?,iterations=? WHERE id=?', c.hash, c.salt, c.iterations, account.id));
  } else {
    await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(activeUser.email, current));
    await updatePassword(auth.currentUser, password);
  }
}
export async function resendVerification() { requireFirebase(); if (!auth.currentUser) throw new Error('Entre novamente.'); await sendEmailVerification(auth.currentUser); }
export async function recoverPassword(email) { requireFirebase(); await sendPasswordResetEmail(auth, email.trim()); }
export async function logout() { if (auth) await signOut(auth); publish(null); }
