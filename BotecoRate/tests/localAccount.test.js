import { test, expect } from "@jest/globals";
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { randomUUID, randomBytes, pbkdf2Sync } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from '../src/database/schema.js';
import { derivePassword, equalHash, PASSWORD_ITERATIONS } from '../src/utils/passwordHash.js';
import { validarSenha } from '../src/utils/senha.js';
import * as usernames from '../src/utils/username.js';
const require = createRequire(import.meta.url);
const {
  transformSync
} = require('@babel/core');

// Serviço real, SQLite real e PBKDF2 real. Só as fronteiras Expo/Firebase
// são substituídas: não cria conta remota nem altera arquivos do aparelho.
function service({
  remoteConfigured = false,
  approvalReadError
} = {}) {
  const sql = new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys=ON;');
  sql.exec(SCHEMA_SQL);
  const db = {
    getAllAsync: async (query, ...params) => sql.prepare(query).all(...params),
    getFirstAsync: async (query, ...params) => sql.prepare(query).get(...params),
    runAsync: async (query, ...params) => sql.prepare(query).run(...params)
  };
  let hashCalls = 0;
  const biometrics = {
    __esModule: true,
    hasHardwareAsync: async () => true,
    isEnrolledAsync: async () => true,
    authenticateAsync: async () => ({
      success: true
    })
  };
  const remoteUser = {
    uid: 'remote-user',
    displayName: 'Pessoa',
    email: 'pessoa@example.test',
    emailVerified: true
  };
  const remoteAuth = {
    currentUser: null
  };
  const remoteAccess = {
    role: 'comum',
    status: 'ativo'
  };
  const network = {
    isConnected: false,
    isInternetReachable: false
  };
  const remoteCalls = [];
  const remoteState = {},
    remoteWrites = [];
  let accessCallback;
  const firebaseAuth = {
    onAuthStateChanged: (target, callback) => {
      queueMicrotask(() => callback(target.currentUser));
      return () => {};
    },
    signInWithEmailAndPassword: async (target, email, password) => {
      remoteCalls.push({
        type: 'login',
        email,
        password
      });
      target.currentUser = remoteUser;
      return {
        user: remoteUser
      };
    },
    createUserWithEmailAndPassword: async (target, email, password) => {
      remoteCalls.push({
        type: 'register',
        email,
        password
      });
      remoteUser.emailVerified = false;
      target.currentUser = remoteUser;
      return {
        user: remoteUser
      };
    },
    updateProfile: async (user, values) => Object.assign(user, values),
    sendEmailVerification: async () => {},
    sendPasswordResetEmail: async (_auth, email) => {
      remoteCalls.push({
        type: 'reset-email',
        email
      });
    },
    deleteUser: async () => {},
    reload: async () => {},
    getIdToken: async () => 'token-only-in-test',
    signOut: async target => {
      target.currentUser = null;
    }
  };
  async function hashPassword(password, salt = randomBytes(16).toString('hex'), iterations = PASSWORD_ITERATIONS) {
    hashCalls++;
    return {
      hash: await derivePassword(password, salt, iterations),
      salt,
      iterations
    };
  }
  const mocks = {
    'expo-crypto': {
      randomUUID
    },
    'firebase/auth': firebaseAuth,
    'firebase/database': {
      onValue: (path, callback) => {
        if (!String(path).includes('/access_control/')) return () => {};
        accessCallback = callback;
        return () => {
          accessCallback = null;
        };
      },
      update: async (_path, changes) => {
        remoteWrites.push(changes);
        for (const [path, value] of Object.entries(changes)) {
          const keys = path.split('/');
          let target = remoteState;
          for (const key of keys.slice(0, -1)) target = target[key] ??= {};
          if (value === null) delete target[keys.at(-1)];else target[keys.at(-1)] = value;
        }
      },
      ref: (_db, path) => path,
      get: async path => {
        if (approvalReadError && path.includes('/owner_approvals/')) throw approvalReadError;
        return {
          val: () => path.includes('access_control') ? remoteAccess : path.split('/').slice(1).reduce((object, key) => object?.[key], remoteState) || null
        };
      }
    },
    'expo-local-authentication': biometrics,
    '@react-native-community/netinfo': {
      fetch: async () => network
    },
    './firebaseConfig': {
      auth: remoteConfigured ? remoteAuth : null,
      db: {},
      requireFirebase: () => {
        if (!remoteConfigured) throw new Error('Firebase não configurado');
      }
    },
    '../database/database': {
      initDatabase: async () => db,
      writeTransaction: async fn => {
        sql.exec('BEGIN');
        try {
          const result = await fn(db);
          sql.exec('COMMIT');
          return result;
        } catch (error) {
          sql.exec('ROLLBACK');
          throw error;
        }
      }
    },
    './passwordService': {
      hashPassword,
      verifyPassword: async (password, account) => equalHash((await hashPassword(password, account.salt, account.iterations)).hash, account.password_hash)
    },
    '../utils/senha': {
      validarSenha
    },
    '../utils/passwordHash': {
      PASSWORD_ITERATIONS
    },
    '../utils/username': usernames
  };
  const source = readFileSync(new URL('../src/services/authService.js', import.meta.url), 'utf8');
  const {
    code
  } = transformSync(source, {
    configFile: false,
    babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs']
  });
  const context = {
    exports: {},
    queueMicrotask,
    require: name => {
      if (!mocks[name]) throw new Error('Import inesperado: ' + name);
      return mocks[name];
    }
  };
  runInNewContext(code, context);
  return {
    api: context.exports,
    sql,
    hashCalls: () => hashCalls,
    biometrics,
    remoteAuth,
    remoteUser,
    remoteAccess,
    network,
    remoteCalls,
    remoteState,
    remoteWrites,
    emitAccess: async () => {
      if (accessCallback) await accessCallback({
        val: () => remoteAccess
      });
    }
  };
}
test('cadastro local sem Firebase persiste verificador e abre sessão sem pedir outra senha', async () => {
  const {
    api,
    sql,
    hashCalls
  } = service();
  const phases = [];
  const sessions = [];
  api.subscribeSession(user => sessions.push(user));
  const user = await api.createLocalAccount('  Emanuel  ', 'Sênha!123', phase => phases.push(phase));
  expect(user.usuario).toBe('Emanuel');
  expect(user.origem).toBe('local');
  expect(user.papel).toBe('comum');
  expect(user.emailVerificado).toBe(false);
  expect(api.getActiveUser().id).toBe(user.id);
  expect(sessions.length).toBe(1);
  expect(hashCalls()).toBe(1);
  expect(phases.length).toBe(2);
  const row = sql.prepare('SELECT * FROM contas_locais').get();
  expect(row.iterations).toBe(PASSWORD_ITERATIONS);
  expect(row.algorithm).toBe('pbkdf2-sha256');
  expect(row.password_hash).not.toBe('Sênha!123');
  expect(Object.hasOwn(user, 'password_hash')).toBe(false);
  expect(Object.hasOwn(user, 'salt')).toBe(false);
  expect(sql.prepare('SELECT COUNT(*) AS n FROM sync_queue').get().n).toBe(0);
  await api.logout();
  expect(api.getActiveUser()).toBe(null);
  const signedIn = await api.loginLocal('EMANUEL', 'Sênha!123');
  expect(signedIn.id).toBe(user.id);
  sql.close();
});
test('duplicidade é informada antes de repetir o cálculo da senha; falha não deixa conta parcial', async () => {
  const {
    api,
    sql,
    hashCalls
  } = service();
  await api.createLocalAccount('Cliente', 'Senha!123');
  await expect(api.createLocalAccount(' CLIENTE ', 'Senha!456')).rejects.toThrow(/já existe/);
  expect(hashCalls()).toBe(1);
  expect(sql.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n).toBe(1);
  expect(sql.prepare('SELECT COUNT(*) AS n FROM contas_locais').get().n).toBe(1);
  sql.close();
});
test('nome vazio e senha inválida não iniciam cálculo nem gravam cadastro', async () => {
  const {
    api,
    sql,
    hashCalls
  } = service();
  await expect(api.createLocalAccount('  ', 'Senha!123')).rejects.toThrow(/nome/);
  await expect(api.createLocalAccount('Cliente', 'curta')).rejects.toThrow(/8 caracteres/);
  expect(hashCalls()).toBe(0);
  expect(api.getActiveUser()).toBe(null);
  expect(sql.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n).toBe(0);
  sql.close();
});
test('conta antiga só migra depois da senha correta, preservando ID e salt individual', async () => {
  const {
    api,
    sql
  } = service();
  const user = await api.createLocalAccount('Legado', 'Senha!123');
  await api.logout();
  const salt = '00112233445566778899aabbccddeeff';
  const old = pbkdf2Sync('Senha!123', Buffer.from(salt, 'hex'), 600000, 32, 'sha256').toString('hex');
  sql.prepare('UPDATE contas_locais SET password_hash=?,salt=?,iterations=600000 WHERE id=?').run(old, salt, user.id);
  await expect(api.loginLocal('Legado', 'Errada!123')).rejects.toThrow(/inválidos/);
  expect(sql.prepare('SELECT iterations FROM contas_locais').get().iterations).toBe(600000);
  expect(api.getActiveUser()).toBe(null);
  const phases = [];
  const signed = await api.loginLocal('Legado', 'Senha!123', value => phases.push(value));
  const updated = sql.prepare('SELECT * FROM contas_locais').get();
  expect(signed.id).toBe(user.id);
  expect(updated.id).toBe(user.id);
  expect(updated.iterations).toBe(PASSWORD_ITERATIONS);
  expect(updated.salt).not.toBe(salt);
  expect(phases[0].includes('Conta antiga')).toBeTruthy();
  await api.logout();
  const newPhases = [];
  await api.loginLocal('Legado', 'Senha!123', value => newPhases.push(value));
  expect(!newPhases[0].includes('Conta antiga')).toBeTruthy();
  sql.close();
});
test('cinco erros aplicam pausa persistida; entrada correta libera sem mudar papel', async () => {
  const {
    api,
    sql,
    hashCalls
  } = service();
  const user = await api.createLocalAccount('Cliente', 'Senha!123');
  await api.logout();
  for (let i = 0; i < 5; i++) await expect(api.loginLocal('Cliente', 'Incorreta!')).rejects.toThrow(/inválidos/);
  const count = hashCalls();
  const guard = sql.prepare('SELECT * FROM local_login_attempts').get();
  expect(guard.failures).toBe(5);
  expect(guard.blocked_until > Date.now()).toBeTruthy();
  await expect(api.loginLocal('Cliente', 'Senha!123')).rejects.toThrow(/Muitas tentativas/);
  expect(hashCalls()).toBe(count);
  // Simula o vencimento sem fazer o teste aguardar 30 segundos.
  sql.prepare('UPDATE local_login_attempts SET blocked_until=?').run(Date.now() - 1);
  const signed = await api.loginLocal('Cliente', 'Senha!123');
  expect(signed.id).toBe(user.id);
  expect(signed.origem).toBe('local');
  expect(signed.papel).toBe('comum');
  expect(sql.prepare('SELECT COUNT(*) AS n FROM local_login_attempts').get().n).toBe(0);
  sql.close();
});
test('troca de sessão durante verificação não entra na conta anterior', async () => {
  const {
    api,
    sql
  } = service();
  await api.createLocalAccount('Cliente', 'Senha!123');
  await api.logout();
  const entering = api.loginLocal('Cliente', 'Senha!123');
  await api.logout();
  await expect(entering).rejects.toThrow(/sessão mudou/);
  expect(api.getActiveUser()).toBe(null);
  sql.close();
});
test('biometria reabre a última conta local após bloquear sem guardar senha ou conceder papel', async () => {
  const {
    api,
    sql,
    hashCalls
  } = service();
  const user = await api.createLocalAccount('Cliente', 'Senha!123');
  await api.lockSession();
  expect(api.getActiveUser()).toBe(null);
  expect((await api.biometricCandidate()).id).toBe(user.id);
  const count = hashCalls();
  const signed = await api.unlockPersistedSession(user.id);
  expect(signed.id).toBe(user.id);
  expect(signed.origem).toBe('local');
  expect(signed.papel).toBe('comum');
  expect(signed.emailVerificado).toBe(false);
  expect(hashCalls()).toBe(count);
  expect(sql.prepare("SELECT value FROM app_settings WHERE key='last_login_account'").get().value).toBe(user.id);
  await api.logout();
  expect(await api.biometricCandidate()).toBe(null);
  await expect(api.unlockPersistedSession(user.id)).rejects.toThrow(/senha/);
  expect(api.getActiveUser()).toBe(null);
  sql.close();
});
test('biometria cancelada, aparelho indisponível ou usuário trocado não cria sessão', async () => {
  const {
    api,
    sql,
    biometrics
  } = service();
  const user = await api.createLocalAccount('Cliente', 'Senha!123');
  await api.lockSession();
  biometrics.authenticateAsync = async () => ({
    success: false,
    error: 'user_cancel'
  });
  await expect(api.unlockPersistedSession(user.id)).rejects.toThrow(/cancelada/);
  expect(api.getActiveUser()).toBe(null);
  biometrics.isEnrolledAsync = async () => false;
  expect(await api.biometricCandidate()).toBe(null);
  await expect(api.unlockPersistedSession(user.id)).rejects.toThrow(/senha/);
  biometrics.isEnrolledAsync = async () => true;
  biometrics.authenticateAsync = async () => {
    await api.logout();
    return {
      success: true
    };
  };
  await expect(api.unlockPersistedSession(user.id)).rejects.toThrow(/mudou/);
  expect(api.getActiveUser()).toBe(null);
  sql.close();
});
test('biometria rejeita alvo diferente e tela cancelada sem chamar o prompt', async () => {
  const {
    api,
    sql,
    biometrics
  } = service();
  const user = await api.createLocalAccount('Cliente', 'Senha!123');
  await api.lockSession();
  let prompted = false;
  biometrics.authenticateAsync = async () => {
    prompted = true;
    return {
      success: true
    };
  };
  await expect(api.unlockPersistedSession('other')).rejects.toThrow(/senha/);
  expect(prompted).toBe(false);
  await expect(api.unlockPersistedSession(user.id, {
    signal: {
      aborted: true
    }
  })).rejects.toThrow(/cancelada/);
  expect(prompted).toBe(false);
  expect(api.getActiveUser()).toBe(null);
  sql.close();
});
test('biometria por e-mail exige sessão salva correspondente e revalida banimento online', async () => {
  const {
    api,
    sql,
    remoteAuth,
    remoteUser,
    remoteAccess,
    network
  } = service({
    remoteConfigured: true
  });
  const user = await api.loginFirebase('pessoa@example.test', 'Senha!123');
  await api.lockSession();
  expect(api.getActiveUser()).toBe(null);
  expect(remoteAuth.currentUser.uid).toBe(user.id);
  expect((await api.biometricCandidate()).id).toBe(user.id);
  expect(api.getActiveUser()).toBe(null); // Descobrir a candidata não faz login automático.
  remoteAuth.currentUser = {
    ...remoteUser,
    uid: 'other'
  };
  expect(await api.biometricCandidate()).toBe(null);
  remoteAuth.currentUser = remoteUser;
  network.isConnected = true;
  network.isInternetReachable = true;
  remoteAccess.status = 'banido';
  await expect(api.unlockPersistedSession(user.id)).rejects.toThrow(/suspensa/);
  expect(api.getActiveUser()).toBe(null);
  remoteAccess.status = 'ativo';
  const signed = await api.unlockPersistedSession(user.id);
  expect(signed.id).toBe(user.id);
  await api.logout();
  expect(remoteAuth.currentUser).toBe(null);
  expect(await api.biometricCandidate()).toBe(null);
  sql.close();
});
test('ativação separa conta nova e conta existente e só vincula UID autenticado', async () => {
  for (const existing of [false, true]) {
    const {
      api,
      sql,
      remoteCalls
    } = service({
      remoteConfigured: true
    });
    const local = await api.createLocalAccount('Cliente', 'Local!123');
    const remote = await api.activateLocalAccount('pessoa@example.test', 'Outra!123', existing);
    expect(remoteCalls[0].type).toBe(existing ? 'login' : 'register');
    expect(remoteCalls[0].password).toBe('Outra!123');
    expect(remote.id).toBe('remote-user');
    expect(remote.origem).toBe('firebase');
    expect(sql.prepare('SELECT firebase_uid FROM ativacoes_conta WHERE local_id=?').get(local.id).firebase_uid).toBe(remote.id);
    expect(sql.prepare('SELECT COUNT(*) AS n FROM contas_locais WHERE id=?').get(local.id).n).toBe(0);
    expect(sql.prepare("SELECT value FROM app_settings WHERE key='last_login_account'").get().value).toBe(remote.id);
    expect(sql.prepare('SELECT COUNT(*) AS n FROM sync_queue').get().n).toBe(0);
    sql.close();
  }
});
test('aprovação ainda indisponível no RTDB não bloqueia o login nem a confirmação do e-mail', async () => {
  const {
    api,
    sql,
    remoteState
  } = service({
    remoteConfigured: true,
    approvalReadError: new Error('Permission denied')
  });
  try {
    const user = await api.loginFirebase('pessoa@example.test', 'Senha!123');
    expect(user.emailVerificado).toBe(true);
    expect(user.cadastroBarAprovado).toBe(false);
    expect((await api.refreshSession()).id).toBe(user.id);
    expect(remoteState.user_directory[user.id].email_verified).toBe(true);
  } finally {
    sql.close();
  }
});
test('conta local aceita variação do nome e ainda exige a senha exata', async () => {
  const {
    api,
    sql
  } = service();
  try {
    const user = await api.createLocalAccount('João Silva', 'Sênha!123');
    await api.logout();
    await expect(api.loginLocal('joao-silva', 'Senha!123')).rejects.toThrow(/inválidos/);
    expect((await api.loginLocal('joao-silva', 'Sênha!123')).id).toBe(user.id);
  } finally {
    sql.close();
  }
});
test('autoridade em tempo real atualiza papel e encerra conta banida sem apagar histórico', async () => {
  const {
    api,
    sql,
    remoteAccess,
    remoteAuth,
    emitAccess
  } = service({
    remoteConfigured: true
  });
  await api.loginFirebase('pessoa@example.test', 'Senha!123');
  let revoked = 0;
  const stop = api.watchAccess(() => revoked++);
  remoteAccess.role = 'admin';
  await emitAccess();
  expect(api.getActiveUser().papel).toBe('admin');
  remoteAccess.role = 'comum';
  await emitAccess();
  expect(api.getActiveUser().papel).toBe('comum');
  remoteAccess.status = 'banido';
  await emitAccess();
  expect(api.getActiveUser()).toBe(null);
  expect(remoteAuth.currentUser).toBe(null);
  expect(revoked).toBe(1);
  expect(sql.prepare("SELECT status FROM usuarios WHERE id='remote-user'").get().status).toBe('banido');
  expect(sql.prepare("SELECT count(*) n FROM app_settings WHERE key='last_login_account'").get().n).toBe(0);
  stop();
  sql.close();
});
test('nome local exige três letras, evita duplicidade normalizada e muda o login com auditoria', async () => {
  const {
    api,
    sql,
    hashCalls
  } = service();
  try {
    for (const invalid of ['12', '..', 'A', 'A12', 'ab.2', 'Ana😀']) await expect(api.createLocalAccount(invalid, 'Senha!123')).rejects.toThrow();
    expect(hashCalls()).toBe(0);
    const user = await api.createLocalAccount('Cliente', 'Senha!123');
    await expect(api.changeProfileName('CLIENTE')).rejects.toThrow(/diferente/);
    await api.changeProfileName('João Silva');
    await expect(api.createLocalAccount('joao.silva', 'Senha!456')).rejects.toThrow(/já existe/);
    const snapshot = sql.prepare('SELECT snapshot_json FROM usuarios_historico').get();
    expect(JSON.parse(snapshot.snapshot_json).usuario).toBe('Cliente');
    expect(snapshot.snapshot_json.includes('password')).toBe(false);
    await api.logout();
    expect((await api.loginLocal('João Silva', 'Senha!123')).id).toBe(user.id);
    await expect(api.loginLocal('Cliente', 'Senha!123')).rejects.toThrow(/inválidos/);
    await api.changePassword('Senha!123', 'Nova!456');
    await api.logout();
    await api.loginLocal('João Silva', 'Nova!456');
  } finally {
    sql.close();
  }
});
test('nome online reserva índice atômico, libera anterior e não muda para nome existente', async () => {
  const {
    api,
    sql,
    remoteState,
    remoteWrites,
    network
  } = service({
    remoteConfigured: true
  });
  try {
    await api.loginFirebase('pessoa@example.test', 'Senha!123');
    await expect(api.changeProfileName('Novo Nome')).rejects.toThrow(/Conecte-se/);
    network.isConnected = true;
    network.isInternetReachable = true;
    remoteState.username_index.ocupado = 'other';
    await expect(api.changeProfileName('Ocupado')).rejects.toThrow(/já existe/);
    await expect(api.changeProfileName('PESSOA')).rejects.toThrow(/diferente/);
    const result = await api.changeProfileName('João Silva');
    expect(result.usuario).toBe('João Silva');
    const changes = remoteWrites.at(-1);
    expect(changes['username_index/joaosilva']).toBe('remote-user');
    expect(changes['username_index/pessoa']).toBe(null);
    expect(changes['profile_history/remote-user/1'].name).toBe('Pessoa');
    expect(changes['public_profiles/remote-user'].name).toBe('João Silva');
    expect(changes['user_directory/remote-user'].name).toBe('João Silva');
  } finally {
    sql.close();
  }
});
test('troca online só solicita e-mail da própria conta, exige rede e não aceita troca direta', async () => {
  const {
    api,
    sql,
    remoteCalls,
    remoteWrites,
    network
  } = service({
    remoteConfigured: true
  });
  try {
    await api.loginFirebase('pessoa@example.test', 'Senha!123');
    await expect(api.requestPasswordChange()).rejects.toThrow(/Conecte-se/);
    network.isConnected = true;
    network.isInternetReachable = true;
    const before = remoteWrites.length;
    await api.requestPasswordChange();
    expect(remoteCalls.at(-1).type).toBe('reset-email');
    expect(remoteCalls.at(-1).email).toBe('pessoa@example.test');
    expect(remoteWrites.length).toBe(before);
    expect(sql.prepare('SELECT count(*) n FROM sync_queue').get().n).toBe(0);
    await expect(api.changePassword('Senha!123', 'Nova!456')).rejects.toThrow(/link de confirmação/);
  } finally {
    sql.close();
  }
});
