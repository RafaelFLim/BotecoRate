import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {SCHEMA_SQL} from '../src/database/schema.js';
import * as protocol from '../src/services/adminProtocol.js';
const require=createRequire(import.meta.url),{transformSync}=require('@babel/core');
function service() {
  const sql=new DatabaseSync(':memory:');sql.exec(SCHEMA_SQL);
  const state={access_control:{admin:{role:'admin',status:'ativo'}},user_directory:{
    admin:{uid:'admin',name:'Administrador',email:'admin@example.test',email_verified:true,updated_at:'2026-10-22'},
    alice:{uid:'alice',name:'Alice',email:'alice@example.test',email_verified:true,updated_at:'2026-10-22'},
  },access_history:{},direct:{}};
  const auth={currentUser:{uid:'admin',emailVerified:true}},session={value:{id:'admin',origem:'firebase',papel:'admin',status:'ativo',emailVerificado:true}};
  const network={isConnected:true,isInternetReachable:true},writes=[];
  const db={runAsync:async(q,...params)=>sql.prepare(q).run(...params)};
  const mocks={
    'firebase/database':{ref:(_db,path)=>path,get:async path=>({val:()=>path.split('/').slice(1).reduce((obj,k)=>obj?.[k],state)}),update:async(_ref,updates)=>writes.push(updates)},
    'expo-crypto':{randomUUID},'@react-native-community/netinfo':{fetch:async()=>network},
    '../database/database':{writeTransaction:async fn=>{sql.exec('BEGIN');try{const result=await fn(db);sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}}},
    './firebaseConfig':{auth,db:{},requireFirebase:()=>{}},'./authService':{getActiveUser:()=>session.value},'./adminProtocol':protocol,
  };
  const source=readFileSync(new URL('../src/services/adminService.js',import.meta.url),'utf8');
  const {code}=transformSync(source,{configFile:false,babelrc:false,plugins:['@babel/plugin-transform-modules-commonjs']});
  const context={exports:{},require:name=>{if(!mocks[name])throw new Error(name);return mocks[name];}};
  runInNewContext(code,context);
  return {api:context.exports,sql,state,session,network,writes};
}
test('painel carrega diretório, preserva papéis locais e replica histórico sem copiar e-mails para o SQLite',async()=>{
  const {api,sql,state}=service();
  state.access_history.alice={1:{actor_uid:'admin',before:{absent:true},record:{role:'comum',status:'banido',version:1,reason:'Abuso confirmado',updated_at:'2026-10-22'}}};
  const data=await api.loadAdministration();assert.equal(data.users.length,2);assert.equal(data.events.length,1);
  const event=sql.prepare('SELECT * FROM vw_historico_acessos').get();
  assert.equal(event.responsavel,'Administrador');assert.equal(event.estado_novo,'banido');
  assert.equal(sql.prepare("SELECT email FROM usuarios WHERE id='alice'").get().email,null);
  await api.loadAdministration();assert.equal(sql.prepare('SELECT count(*) n FROM admin_access_historico').get().n,1);
  sql.close();
});
test('painel recusa offline e sessão bloqueada, mesmo com Authentication persistido no aparelho',async()=>{
  const {api,sql,session,network,writes}=service();
  network.isConnected=false;await assert.rejects(api.loadAdministration(),/internet/);
  network.isConnected=true;session.value=null;
  await assert.rejects(api.changeUserAccess('alice','banir','Abuso confirmado'),/sessão administrativa/);
  assert.equal(writes.length,0);sql.close();
});
