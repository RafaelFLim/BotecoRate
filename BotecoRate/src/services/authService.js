import { randomUUID } from 'expo-crypto';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification,
  sendPasswordResetEmail, signOut, updateProfile, updatePassword, EmailAuthProvider,
  reauthenticateWithCredential, onAuthStateChanged, reload, getIdToken } from 'firebase/auth';
import { get, ref, update, onValue } from 'firebase/database';
import { auth, db as remote, requireFirebase } from './firebaseConfig';
import { initDatabase, writeTransaction } from '../database/database';
import { hashPassword, verifyPassword } from './passwordService';
import { validarSenha } from '../utils/senha';
import { PASSWORD_ITERATIONS } from '../utils/passwordHash';
import * as LocalAuthentication from 'expo-local-authentication';
import NetInfo from '@react-native-community/netinfo';

let activeUser = null;
let sessionRevision = 0;
const listeners = new Set();
export const getActiveUser = () => activeUser;
export const subscribeSession = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
function publish(user) { sessionRevision++; activeUser = user; for (const fn of listeners) fn(user); return user; }
const rememberedAccountKey = 'last_login_account';
async function rememberAccount(id, expectedRevision) {
  await writeTransaction(tx => {
    if (expectedRevision !== undefined && expectedRevision !== sessionRevision) throw new Error('A conta mudou. Entre novamente com sua senha.');
    return tx.runAsync('INSERT INTO app_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', rememberedAccountKey, id);
  });
}
const viewUser = (u) => ({ id: u.id, usuario: u.usuario, email: u.email, origem: u.origem,
  papel: u.papel, status: u.status, emailVerificado: Boolean(u.email_verificado) });

export function friendlyAuthError(error) {
  const messages = {
    'auth/invalid-credential': 'E-mail ou senha inválidos.',
    'auth/email-already-in-use': 'Este e-mail já tem conta. Entre ou recupere a senha.',
    'auth/network-request-failed': 'Não foi possível conectar. Tente novamente quando houver internet.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde antes de tentar de novo.',
    'auth/invalid-email': 'Informe um e-mail válido.',
    'auth/weak-password': 'Escolha uma senha mais forte para sua conta.',
  };
  return messages[error.code] || error.message || 'Não foi possível concluir esta operação.';
}

export async function createLocalAccount(username, password, onProgress = () => {}) {
  const name = username.trim();
  const problem = validarSenha(password);
  if (!name || problem) throw new Error(problem || 'Informe seu nome de usuário.');
  const local = await initDatabase();
  if (await local.getFirstAsync('SELECT id FROM contas_locais WHERE usuario_normalizado=?', name.toLowerCase())) throw new Error('Este usuário já existe neste aparelho. Entre com sua conta local.');
  onProgress('Protegendo sua senha…');
  const credential = await hashPassword(password);
  const id = `local:${randomUUID()}`;
  const now = new Date().toISOString();
  onProgress('Salvando sua conta…');
  await writeTransaction(async (tx) => {
    if (await tx.getFirstAsync('SELECT id FROM contas_locais WHERE usuario_normalizado=?', name.toLowerCase())) throw new Error('Este usuário já existe neste aparelho.');
    await tx.runAsync("INSERT INTO usuarios(id,usuario,origem,created_at,updated_at) VALUES (?,?,'local',?,?)", id, name, now, now);
    await tx.runAsync("INSERT INTO contas_locais(id,usuario_normalizado,password_hash,salt,iterations,algorithm,created_at) VALUES (?,?,?,?,?,'pbkdf2-sha256',?)", id, name.toLowerCase(), credential.hash, credential.salt, credential.iterations, now);
  });
  const user = await local.getFirstAsync('SELECT * FROM usuarios WHERE id=?', id);
  await rememberAccount(id);
  return publish(viewUser(user));
}

let localLoginRunning = false;
export async function loginLocal(username, password, onProgress = () => {}) {
  if (localLoginRunning) throw new Error('Aguarde a entrada em andamento.');
  localLoginRunning = true;
  const revision = sessionRevision;
  try {
    const db = await initDatabase();
    const account = await db.getFirstAsync('SELECT * FROM contas_locais WHERE usuario_normalizado=? AND deleted_at IS NULL AND firebase_uid IS NULL', username.trim().toLowerCase());
    if (!account) throw new Error('Usuário ou senha local inválidos.');
    const guard = await db.getFirstAsync('SELECT * FROM local_login_attempts WHERE account_id=?', account.id);
    if (guard?.blocked_until > Date.now()) throw new Error(`Muitas tentativas. Tente novamente em ${Math.ceil((guard.blocked_until - Date.now()) / 1000)} segundos.`);
    const user = await db.getFirstAsync('SELECT * FROM usuarios WHERE id=? AND deleted_at IS NULL', account.id);
    if (!user || user.status !== 'ativo') throw new Error('Esta conta não está ativa.');
    const legacy = account.iterations > PASSWORD_ITERATIONS;
    onProgress(legacy ? 'Conta antiga: verificando sua senha. Esta primeira entrada pode levar cerca de um minuto ou mais.' : 'Conferindo sua senha…');
    if (!(await verifyPassword(password, account))) {
      await writeTransaction(async tx => {
        const current = await tx.getFirstAsync('SELECT * FROM local_login_attempts WHERE account_id=?', account.id);
        const failures = current?.blocked_until ? 1 : (current?.failures || 0) + 1;
        await tx.runAsync('INSERT INTO local_login_attempts(account_id,failures,blocked_until) VALUES (?,?,?) ON CONFLICT(account_id) DO UPDATE SET failures=excluded.failures,blocked_until=excluded.blocked_until', account.id, failures, failures >= 5 ? Date.now() + 30000 : 0);
      });
      throw new Error('Usuário ou senha local inválidos.');
    }
    if (sessionRevision !== revision) throw new Error('A sessão mudou durante a entrada. Tente novamente.');
    // Não há como converter o hash antigo sem conferir a senha correta uma vez.
    // Só após a confirmação trocar salt/custo, sem recriar conta ou perder ID.
    if (legacy) onProgress('Atualizando a proteção desta conta…');
    const replacement = legacy ? await hashPassword(password) : null;
    await writeTransaction(async tx => {
      if (sessionRevision !== revision) throw new Error('A sessão mudou durante a entrada. Tente novamente.');
      const latest = await tx.getFirstAsync('SELECT * FROM contas_locais WHERE id=? AND deleted_at IS NULL AND firebase_uid IS NULL', account.id);
      const active = await tx.getFirstAsync("SELECT * FROM usuarios WHERE id=? AND deleted_at IS NULL AND status='ativo'", account.id);
      if (!latest || !active || latest.password_hash !== account.password_hash) throw new Error('A conta mudou durante a entrada. Tente novamente.');
      if (replacement) await tx.runAsync('UPDATE contas_locais SET password_hash=?,salt=?,iterations=? WHERE id=?', replacement.hash, replacement.salt, replacement.iterations, account.id);
      await tx.runAsync('DELETE FROM local_login_attempts WHERE account_id=?', account.id);
      await tx.runAsync('INSERT INTO app_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', rememberedAccountKey, account.id);
    });
    if (sessionRevision !== revision) throw new Error('A sessão mudou durante a entrada. Tente novamente.');
    return publish(viewUser(user));
  } finally { localLoginRunning = false; }
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
  let remoteAccess=null;
  let role = previous?.papel || 'comum';
  let status = previous?.status || 'ativo';
  let name = previous?.usuario || user.displayName || user.email.split('@')[0];
  if (online) {
    const access = (await get(ref(remote, `v1/access_control/${user.uid}`))).val();
    const profile = (await get(ref(remote, `v1/public_profiles/${user.uid}`))).val();
    remoteAccess=access;
    role = access?.role || 'comum'; status = access?.status || 'ativo';
    name = profile?.name || user.displayName || name;
  }
  if (status !== 'ativo') throw new Error('Sua conta está suspensa ou excluída. Entre em contato com a administração.');
  const now = new Date().toISOString();
  if (online) await update(ref(remote,'v1'), {
    [`user_directory/${user.uid}`]:{uid:user.uid,name:name.slice(0,100),email:user.email,email_verified:Boolean(user.emailVerified),updated_at:now},
    [`ownership_accounts/${user.uid}`]:{uid:user.uid,name:name.slice(0,100),email_verified:Boolean(user.emailVerified),updated_at:now,
      access:{role,status,version:remoteAccess?.version||0,initialized:Boolean(remoteAccess)}},
  });
  await writeTransaction(async (tx) => {
    await tx.runAsync(`INSERT INTO usuarios(id,usuario,email,origem,papel,status,email_verificado,created_at,updated_at)
      VALUES (?,?,?,'firebase',?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET usuario=excluded.usuario,email=excluded.email,papel=excluded.papel,status=excluded.status,email_verificado=excluded.email_verificado,updated_at=excluded.updated_at,deleted_at=NULL`,
    user.uid, name, user.email, role, status, user.emailVerified ? 1 : 0, previous?.created_at || now, now);
  });
  previous = await local.getFirstAsync('SELECT * FROM usuarios WHERE id=?', user.uid);
  return viewUser(previous);
}

export async function loginFirebase(email, password) {
  requireFirebase();
  const { user } = await signInWithEmailAndPassword(auth, email.trim(), password);
  try { const session = await cacheFirebaseUser(user); await rememberAccount(session.id); return publish(session); }
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
  await rememberAccount(session.id);
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
  const [hardware, enrolled] = await Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()]);
  if (!hardware || !enrolled) return null;
  const db = await initDatabase();
  const saved = await db.getFirstAsync('SELECT value FROM app_settings WHERE key=?', rememberedAccountKey);
  if (saved) {
    const user = await db.getFirstAsync("SELECT * FROM usuarios WHERE id=? AND deleted_at IS NULL AND status='ativo'", saved.value);
    if (!user) return null;
    if (user.origem === 'local') {
      const credential = await db.getFirstAsync('SELECT id FROM contas_locais WHERE id=? AND deleted_at IS NULL AND firebase_uid IS NULL', user.id);
      return credential ? viewUser(user) : null;
    }
    if (!auth) return null;
    await waitForAuth();
    return auth.currentUser?.uid === user.id ? viewUser(user) : null;
  }
  // Compatibilidade com sessões de e-mail já persistidas na versão anterior.
  if (!auth) return null;
  await waitForAuth();
  return auth.currentUser ? cacheFirebaseUser(auth.currentUser, {online:false}) : null;
}
let biometricRunning = false;
export async function unlockPersistedSession(expectedId, {signal} = {}) {
  if (biometricRunning) throw new Error('Já existe uma confirmação de biometria em andamento.');
  biometricRunning = true;
  const revision = sessionRevision;
  try {
    const candidate = await biometricCandidate();
    if (signal?.aborted || revision !== sessionRevision) throw new Error('A confirmação foi cancelada.');
    if (!candidate || (expectedId && expectedId !== candidate.id)) throw new Error('Entre com sua senha para usar a biometria nesta conta.');
    const result = await LocalAuthentication.authenticateAsync({promptMessage:'Entrar no BotecoRate',cancelLabel:'Usar senha',disableDeviceFallback:true});
    if (!result.success) throw new Error(['user_cancel','app_cancel','system_cancel'].includes(result.error) ? 'Confirmação cancelada. Você pode entrar com sua senha.' : 'Não foi possível confirmar a biometria. Tente novamente ou use sua senha.');
    const current = await biometricCandidate();
    if (signal?.aborted || revision !== sessionRevision || current?.id !== candidate.id) throw new Error('A conta mudou. Entre novamente com sua senha.');
    if (current.origem === 'local') return publish(current);
    if (!auth?.currentUser || auth.currentUser.uid !== candidate.id) throw new Error('Entre novamente com seu e-mail e senha.');
    const firebaseUser = auth.currentUser;
    const state = await NetInfo.fetch();
    const online = state.isConnected && state.isInternetReachable !== false;
    if (online) { await reload(firebaseUser); await getIdToken(firebaseUser, true); }
    if (signal?.aborted || revision !== sessionRevision || auth.currentUser?.uid !== candidate.id) throw new Error('A conta mudou. Entre novamente com sua senha.');
    const session = await cacheFirebaseUser(firebaseUser, {online});
    if (signal?.aborted || revision !== sessionRevision || auth.currentUser?.uid !== candidate.id) throw new Error('A conta mudou. Entre novamente com sua senha.');
    await rememberAccount(session.id, revision);
    if (signal?.aborted || revision !== sessionRevision || auth.currentUser?.uid !== candidate.id) throw new Error('A conta mudou. Entre novamente com sua senha.');
    return publish(session);
  } finally { biometricRunning = false; }
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
  if (!activeUser || !name.trim() || name.trim().length>100) throw new Error('Informe um nome entre 1 e 100 caracteres.');
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
      ['ownership_accounts/' + user.id + '/name']: name.trim(),
      ['ownership_accounts/' + user.id + '/updated_at']: changedAt,
      ['user_directory/' + user.id]: {uid:user.id,name:name.trim(),email:auth.currentUser.email,email_verified:true,updated_at:changedAt},
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
export async function lockSession() { publish(null); }
export async function logout() {
  if (auth) await signOut(auth);
  await writeTransaction(tx => tx.runAsync('DELETE FROM app_settings WHERE key=?', rememberedAccountKey));
  publish(null);
}

// A revogação é aplicada no servidor e refletida na sessão aberta assim que conectada.
export function watchAccess(onRevoked = () => {}) {
  const uid=activeUser?.origem==='firebase' ? activeUser.id : null;
  if (!uid || !remote) return () => {};
  let stopped=false;
  const stop=onValue(ref(remote,`v1/access_control/${uid}`), async snapshot=>{
    const access=snapshot.val()||{role:'comum',status:'ativo'};
    if(stopped || activeUser?.id!==uid) return;
    const previous=activeUser;
    try {
      await writeTransaction(async tx=>{
        if(stopped || activeUser?.id!==uid) return;
        await tx.runAsync('UPDATE usuarios SET papel=?,status=?,updated_at=?,deleted_at=? WHERE id=?',access.role,access.status,access.updated_at||new Date().toISOString(),access.deleted_at||null,uid);
      });
      if(stopped || activeUser?.id!==uid) return;
      if(access.status!=='ativo') {
        // Retira o acesso à interface antes de esperar pela rede.
        publish(null);
        await writeTransaction(tx=>tx.runAsync('DELETE FROM app_settings WHERE key=? AND value=?',rememberedAccountKey,uid));
        if(auth.currentUser?.uid===uid) await signOut(auth);
        onRevoked();
      } else if(previous.papel!==access.role) publish({...previous,papel:access.role});
    } catch { /* Sem autoridade local para desfazer uma revogação remota. Revalida no login. */ }
  });
  return ()=>{stopped=true;stop();};
}
