import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {randomUUID} from 'node:crypto';
import {SCHEMA_SQL} from '../src/database/schema.js';
import {saveOwnership} from '../src/database/ownershipStore.js';
import * as protocol from '../src/services/ownershipProtocol.js';
const require=createRequire(import.meta.url),{transformSync}=require('@babel/core');
function service() {
  const sql=new DatabaseSync(':memory:');sql.exec(SCHEMA_SQL);
  const db={getAllAsync:async(q,...p)=>sql.prepare(q).all(...p),getFirstAsync:async(q,...p)=>sql.prepare(q).get(...p),runAsync:async(q,...p)=>sql.prepare(q).run(...p)};
  const remote={v1:{direct:{entities:{bares:{bar:{id:'bar',nome:'Bar'}}},owners:{bar:{a:true,b:true}},ownership_state:{bar:{version:0,owner_order:'|a|b|'}}},ownership_accounts:Object.fromEntries(['a','b','c'].map(uid=>[uid,{uid,name:uid,email_verified:true,access:{role:uid==='c'?'comum':'dono',status:'ativo',version:0,initialized:false}}]))}};
  const auth={currentUser:{uid:'a'}},session={id:'a',origem:'firebase',emailVerificado:true,status:'ativo',papel:'dono'};
  const network={isConnected:true,isInternetReachable:true},writes=[],failure={final:false};
  const mocks={
    'firebase/database':{ref:(_db,p)=>p,get:async p=>({val:()=>structuredClone(p.split('/').reduce((obj,k)=>obj?.[k],remote))}),update:async(p,updates)=>{
      writes.push(updates);for(const [path,value] of Object.entries(updates)){const parts=(p+'/'+path).split('/');let obj=remote;for(const k of parts.slice(0,-1))obj=obj[k]??={};if(value===null)delete obj[parts.at(-1)];else obj[parts.at(-1)]=structuredClone(value);}
      if(failure.final && Object.entries(updates).some(([k,v])=>k.endsWith('/status')&&v==='concluida')){failure.final=false;throw new Error('Resposta perdida depois do commit');}
    }},
    'expo-crypto':{randomUUID},'@react-native-community/netinfo':{fetch:async()=>network},
    './firebaseConfig':{auth,db:{},requireFirebase:()=>{}},'./authService':{getActiveUser:()=>session},
    '../database/database':{initDatabase:async()=>db,writeTransaction:async work=>{sql.exec('BEGIN');try{const result=await work(db);sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}}},
    '../database/ownershipStore':{saveOwnership},'./ownershipProtocol':protocol,
  };
  const {code}=transformSync(readFileSync(new URL('../src/services/ownershipService.js',import.meta.url),'utf8'),{configFile:false,babelrc:false,plugins:['@babel/plugin-transform-modules-commonjs']});
  const context={exports:{},require:name=>{if(!mocks[name])throw new Error(name);return mocks[name];}};runInNewContext(code,context);
  return {api:context.exports,sql,remote,network,writes,loseFinalResponse:()=>{failure.final=true;},actor:uid=>{session.id=uid;auth.currentUser.uid=uid;}};
}
test('serviço conclui assinaturas fora de ordem, promove convidado e salva histórico legível no SQLite',async()=>{
  const {api,remote,sql,actor,loseFinalResponse}=service();
  await api.inviteOwnership({barId:'bar',recipient:'c',replaceUid:'a',reason:'Transferência consensual'});
  const id=Object.keys(remote.v1.direct.ownership_requests.bar)[0];
  actor('c');await api.answerOwnership('bar',id,'aceitar');
  actor('b');await api.answerOwnership('bar',id,'aceitar');
  actor('a');loseFinalResponse();await api.answerOwnership('bar',id,'aceitar');
  assert.deepEqual(remote.v1.direct.owners.bar,{b:true,c:true});assert.equal(remote.v1.access_control.c.role,'dono');assert.equal(Object.keys(remote.v1.direct.ownership_history.bar[id]).length,6);
  const view=await api.loadOwnership();assert.equal(view.requests[0].status,'concluida');assert.equal(view.bars.length,0);
  assert.equal(sql.prepare("SELECT count(*) n FROM vw_historico_propriedade WHERE estado_novo='concluida'").get().n,1);
  assert.equal(sql.prepare('SELECT count(*) n FROM ownership_votes').get().n,3);sql.close();
});
test('consulta offline é separada por conta e ações offline não criam fila de transferência',async()=>{
  const {api,sql,network,writes,actor}=service();await api.loadOwnership();network.isConnected=false;
  const view=await api.loadOwnership();assert.equal(view.online,false);assert.equal(view.actor,'a');
  await assert.rejects(api.inviteOwnership({barId:'bar',recipient:'c',reason:'Novo sócio'}),/internet/);
  assert.equal(writes.length,0);actor('c');await assert.rejects(api.loadOwnership(),/Conecte-se uma vez/);sql.close();
});
