import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { randomUUID, randomBytes, pbkdf2Sync } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from '../src/database/schema.js';
import { derivePassword, equalHash, PASSWORD_ITERATIONS } from '../src/utils/passwordHash.js';
import { validarSenha } from '../src/utils/senha.js';

const require = createRequire(import.meta.url);
const {transformSync} = require('@babel/core');

// Serviço real, SQLite real e PBKDF2 real. Só as fronteiras Expo/Firebase
// são substituídas: não cria conta remota nem altera arquivos do aparelho.
function service({remoteConfigured = false} = {}) {
  const sql = new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON;');sql.exec(SCHEMA_SQL);
  const db = {
    getFirstAsync: async (query,...params)=>sql.prepare(query).get(...params),
    runAsync: async (query,...params)=>sql.prepare(query).run(...params),
  };
  let hashCalls = 0;
  const biometrics = {__esModule:true,hasHardwareAsync:async()=>true,isEnrolledAsync:async()=>true,authenticateAsync:async()=>({success:true})};
  const remoteUser = {uid:'remote-user',displayName:'Pessoa',email:'pessoa@example.test',emailVerified:true};
  const remoteAuth = {currentUser:null};
  const remoteAccess = {role:'comum',status:'ativo'};
  const network = {isConnected:false,isInternetReachable:false};
  const remoteCalls = [];
  let accessCallback;
  const firebaseAuth = {
    onAuthStateChanged:(target,callback)=>{queueMicrotask(()=>callback(target.currentUser));return ()=>{};},
    signInWithEmailAndPassword:async(target,email,password)=>{remoteCalls.push({type:'login',email,password});target.currentUser=remoteUser;return {user:remoteUser};},
    createUserWithEmailAndPassword:async(target,email,password)=>{remoteCalls.push({type:'register',email,password});remoteUser.emailVerified=false;target.currentUser=remoteUser;return {user:remoteUser};},
    updateProfile:async(user,values)=>Object.assign(user,values),sendEmailVerification:async()=>{},
    reload:async()=>{},getIdToken:async()=> 'token-only-in-test',signOut:async target=>{target.currentUser=null;},
  };
  async function hashPassword(password,salt=randomBytes(16).toString('hex'),iterations=PASSWORD_ITERATIONS) {
    hashCalls++;
    return {hash:await derivePassword(password,salt,iterations),salt,iterations};
  }
  const mocks = {
    'expo-crypto':{randomUUID},'firebase/auth':firebaseAuth,
    'firebase/database':{onValue:(_ref,callback)=>{accessCallback=callback;return()=>{accessCallback=null;};},update:async()=>{},ref:(_db,path)=>path,get:async path=>({val:()=>path.includes('access_control') ? remoteAccess : null})},
    'expo-local-authentication':biometrics,'@react-native-community/netinfo':{fetch:async()=>network},
    './firebaseConfig':{auth:remoteConfigured ? remoteAuth : null,db:{},requireFirebase:()=>{if(!remoteConfigured)throw new Error('Firebase não configurado');}},
    '../database/database':{initDatabase:async()=>db,writeTransaction:async fn=>{
      sql.exec('BEGIN');try {const result=await fn(db);sql.exec('COMMIT');return result;}catch(error){sql.exec('ROLLBACK');throw error;}
    }},
    './passwordService':{hashPassword,verifyPassword:async(password,account)=>equalHash((await hashPassword(password,account.salt,account.iterations)).hash,account.password_hash)},
    '../utils/senha':{validarSenha},
    '../utils/passwordHash':{PASSWORD_ITERATIONS},
  };
  const source = readFileSync(new URL('../src/services/authService.js',import.meta.url),'utf8');
  const {code}=transformSync(source,{configFile:false,babelrc:false,plugins:['@babel/plugin-transform-modules-commonjs']});
  const context={exports:{},queueMicrotask,require:name=>{if(!mocks[name])throw new Error('Import inesperado: '+name);return mocks[name];}};
  runInNewContext(code,context);
  return {api:context.exports,sql,hashCalls:()=>hashCalls,biometrics,remoteAuth,remoteUser,remoteAccess,network,remoteCalls,emitAccess:async()=>{if(accessCallback)await accessCallback({val:()=>remoteAccess});}};
}

test('cadastro local sem Firebase persiste verificador e abre sessão sem pedir outra senha',async()=>{
  const {api,sql,hashCalls}=service();const phases=[];const sessions=[];
  api.subscribeSession(user=>sessions.push(user));
  const user=await api.createLocalAccount('  Emanuel  ','Sênha!123',phase=>phases.push(phase));
  assert.equal(user.usuario,'Emanuel');assert.equal(user.origem,'local');assert.equal(user.papel,'comum');
  assert.equal(user.emailVerificado,false);assert.equal(api.getActiveUser().id,user.id);assert.equal(sessions.length,1);
  assert.equal(hashCalls(),1);assert.equal(phases.length,2);
  const row=sql.prepare('SELECT * FROM contas_locais').get();
  assert.equal(row.iterations,PASSWORD_ITERATIONS);assert.equal(row.algorithm,'pbkdf2-sha256');assert.notEqual(row.password_hash,'Sênha!123');
  assert.equal(Object.hasOwn(user,'password_hash'),false);assert.equal(Object.hasOwn(user,'salt'),false);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM sync_queue').get().n,0);
  await api.logout();assert.equal(api.getActiveUser(),null);
  const signedIn=await api.loginLocal('EMANUEL','Sênha!123');assert.equal(signedIn.id,user.id);
  sql.close();
});

test('duplicidade é informada antes de repetir o cálculo da senha; falha não deixa conta parcial',async()=>{
  const {api,sql,hashCalls}=service();await api.createLocalAccount('Cliente','Senha!123');
  await assert.rejects(api.createLocalAccount(' CLIENTE ','Senha!456'),/já existe/);
  assert.equal(hashCalls(),1);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n,1);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM contas_locais').get().n,1);
  sql.close();
});

test('nome vazio e senha inválida não iniciam cálculo nem gravam cadastro',async()=>{
  const {api,sql,hashCalls}=service();
  await assert.rejects(api.createLocalAccount('  ','Senha!123'),/nome/);
  await assert.rejects(api.createLocalAccount('Cliente','curta'),/8 caracteres/);
  assert.equal(hashCalls(),0);assert.equal(api.getActiveUser(),null);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n,0);
  sql.close();
});

test('conta antiga só migra depois da senha correta, preservando ID e salt individual',async()=>{
  const {api,sql}=service();const user=await api.createLocalAccount('Legado','Senha!123');await api.logout();
  const salt='00112233445566778899aabbccddeeff';
  const old=pbkdf2Sync('Senha!123',Buffer.from(salt,'hex'),600000,32,'sha256').toString('hex');
  sql.prepare('UPDATE contas_locais SET password_hash=?,salt=?,iterations=600000 WHERE id=?').run(old,salt,user.id);
  await assert.rejects(api.loginLocal('Legado','Errada!123'),/inválidos/);
  assert.equal(sql.prepare('SELECT iterations FROM contas_locais').get().iterations,600000);
  assert.equal(api.getActiveUser(),null);
  const phases=[];
  const signed=await api.loginLocal('Legado','Senha!123',value=>phases.push(value));
  const updated=sql.prepare('SELECT * FROM contas_locais').get();
  assert.equal(signed.id,user.id);assert.equal(updated.id,user.id);assert.equal(updated.iterations,PASSWORD_ITERATIONS);
  assert.notEqual(updated.salt,salt);assert.ok(phases[0].includes('Conta antiga'));
  await api.logout();
  const newPhases=[];await api.loginLocal('Legado','Senha!123',value=>newPhases.push(value));
  assert.ok(!newPhases[0].includes('Conta antiga'));
  sql.close();
});

test('cinco erros aplicam pausa persistida; entrada correta libera sem mudar papel',async()=>{
  const {api,sql,hashCalls}=service();const user=await api.createLocalAccount('Cliente','Senha!123');await api.logout();
  for(let i=0;i<5;i++) await assert.rejects(api.loginLocal('Cliente','Incorreta!'),/inválidos/);
  const count=hashCalls();
  const guard=sql.prepare('SELECT * FROM local_login_attempts').get();
  assert.equal(guard.failures,5);assert.ok(guard.blocked_until>Date.now());
  await assert.rejects(api.loginLocal('Cliente','Senha!123'),/Muitas tentativas/);
  assert.equal(hashCalls(),count);
  // Simula o vencimento sem fazer o teste aguardar 30 segundos.
  sql.prepare('UPDATE local_login_attempts SET blocked_until=?').run(Date.now()-1);
  const signed=await api.loginLocal('Cliente','Senha!123');
  assert.equal(signed.id,user.id);assert.equal(signed.origem,'local');assert.equal(signed.papel,'comum');
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM local_login_attempts').get().n,0);
  sql.close();
});

test('troca de sessão durante verificação não entra na conta anterior',async()=>{
  const {api,sql}=service();await api.createLocalAccount('Cliente','Senha!123');await api.logout();
  const entering=api.loginLocal('Cliente','Senha!123');
  await api.logout();
  await assert.rejects(entering,/sessão mudou/);
  assert.equal(api.getActiveUser(),null);
  sql.close();
});

test('biometria reabre a última conta local após bloquear sem guardar senha ou conceder papel',async()=>{
  const {api,sql,hashCalls}=service();const user=await api.createLocalAccount('Cliente','Senha!123');
  await api.lockSession();assert.equal(api.getActiveUser(),null);
  assert.equal((await api.biometricCandidate()).id,user.id);
  const count=hashCalls();const signed=await api.unlockPersistedSession(user.id);
  assert.equal(signed.id,user.id);assert.equal(signed.origem,'local');assert.equal(signed.papel,'comum');assert.equal(signed.emailVerificado,false);
  assert.equal(hashCalls(),count);assert.equal(sql.prepare("SELECT value FROM app_settings WHERE key='last_login_account'").get().value,user.id);
  await api.logout();assert.equal(await api.biometricCandidate(),null);
  await assert.rejects(api.unlockPersistedSession(user.id),/senha/);assert.equal(api.getActiveUser(),null);
  sql.close();
});

test('biometria cancelada, aparelho indisponível ou usuário trocado não cria sessão',async()=>{
  const {api,sql,biometrics}=service();const user=await api.createLocalAccount('Cliente','Senha!123');await api.lockSession();
  biometrics.authenticateAsync=async()=>({success:false,error:'user_cancel'});
  await assert.rejects(api.unlockPersistedSession(user.id),/cancelada/);assert.equal(api.getActiveUser(),null);
  biometrics.isEnrolledAsync=async()=>false;assert.equal(await api.biometricCandidate(),null);
  await assert.rejects(api.unlockPersistedSession(user.id),/senha/);
  biometrics.isEnrolledAsync=async()=>true;
  biometrics.authenticateAsync=async()=>{await api.logout();return {success:true};};
  await assert.rejects(api.unlockPersistedSession(user.id),/mudou/);assert.equal(api.getActiveUser(),null);
  sql.close();
});

test('biometria rejeita alvo diferente e tela cancelada sem chamar o prompt',async()=>{
  const {api,sql,biometrics}=service();const user=await api.createLocalAccount('Cliente','Senha!123');await api.lockSession();
  let prompted=false;biometrics.authenticateAsync=async()=>{prompted=true;return {success:true};};
  await assert.rejects(api.unlockPersistedSession('other'),/senha/);assert.equal(prompted,false);
  await assert.rejects(api.unlockPersistedSession(user.id,{signal:{aborted:true}}),/cancelada/);assert.equal(prompted,false);
  assert.equal(api.getActiveUser(),null);sql.close();
});

test('biometria por e-mail exige sessão salva correspondente e revalida banimento online',async()=>{
  const {api,sql,remoteAuth,remoteUser,remoteAccess,network}=service({remoteConfigured:true});
  const user=await api.loginFirebase('pessoa@example.test','Senha!123');await api.lockSession();
  assert.equal(api.getActiveUser(),null);
  assert.equal(remoteAuth.currentUser.uid,user.id);
  assert.equal((await api.biometricCandidate()).id,user.id);
  assert.equal(api.getActiveUser(),null); // Descobrir a candidata não faz login automático.
  remoteAuth.currentUser={...remoteUser,uid:'other'};
  assert.equal(await api.biometricCandidate(),null);
  remoteAuth.currentUser=remoteUser;
  network.isConnected=true;network.isInternetReachable=true;remoteAccess.status='banido';
  await assert.rejects(api.unlockPersistedSession(user.id),/suspensa/);assert.equal(api.getActiveUser(),null);
  remoteAccess.status='ativo';const signed=await api.unlockPersistedSession(user.id);assert.equal(signed.id,user.id);
  await api.logout();assert.equal(remoteAuth.currentUser,null);assert.equal(await api.biometricCandidate(),null);
  sql.close();
});

test('ativação separa conta nova e conta existente e só vincula UID autenticado',async()=>{
  for(const existing of [false,true]) {
    const {api,sql,remoteCalls}=service({remoteConfigured:true});
    const local=await api.createLocalAccount('Cliente','Local!123');
    const remote=await api.activateLocalAccount('pessoa@example.test','Outra!123',existing);
    assert.equal(remoteCalls[0].type,existing ? 'login' : 'register');
    assert.equal(remoteCalls[0].password,'Outra!123');
    assert.equal(remote.id,'remote-user');assert.equal(remote.origem,'firebase');
    assert.equal(sql.prepare('SELECT firebase_uid FROM ativacoes_conta WHERE local_id=?').get(local.id).firebase_uid,remote.id);
    assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM contas_locais WHERE id=?').get(local.id).n,0);
    assert.equal(sql.prepare("SELECT value FROM app_settings WHERE key='last_login_account'").get().value,remote.id);
    assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM sync_queue').get().n,0);
    sql.close();
  }
});

test('autoridade em tempo real atualiza papel e encerra conta banida sem apagar histórico',async()=>{
  const {api,sql,remoteAccess,remoteAuth,emitAccess}=service({remoteConfigured:true});
  await api.loginFirebase('pessoa@example.test','Senha!123');
  let revoked=0;const stop=api.watchAccess(()=>revoked++);
  remoteAccess.role='admin';await emitAccess();assert.equal(api.getActiveUser().papel,'admin');
  remoteAccess.role='comum';await emitAccess();assert.equal(api.getActiveUser().papel,'comum');
  remoteAccess.status='banido';await emitAccess();
  assert.equal(api.getActiveUser(),null);assert.equal(remoteAuth.currentUser,null);assert.equal(revoked,1);
  assert.equal(sql.prepare("SELECT status FROM usuarios WHERE id='remote-user'").get().status,'banido');
  assert.equal(sql.prepare("SELECT count(*) n FROM app_settings WHERE key='last_login_account'").get().n,0);
  stop();sql.close();
});
