import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {initializeApp,deleteApp} from 'firebase/app';
import * as storageSDK from 'firebase/storage';

const require=createRequire(import.meta.url);
const {transformSync}=require('@babel/core');
const source=readFileSync(new URL('../src/services/firebaseConfig.js',import.meta.url),'utf8');
const code=transformSync(source,{babelrc:false,configFile:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code;

for(const withBucket of [true,false]) test(`configuração inicializa com SDK Storage real; bucket ${withBucket?'presente':'opcional ausente'}`,async()=>{
  let app;
  const exports={};
  const env={EXPO_PUBLIC_FIREBASE_API_KEY:'test-client-key',EXPO_PUBLIC_FIREBASE_PROJECT_ID:'demo-config-tests',
    EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN:'demo-config-tests.firebaseapp.com',EXPO_PUBLIC_FIREBASE_APP_ID:'test-app-id',
    EXPO_PUBLIC_FIREBASE_DATABASE_URL:'https://demo-config-tests-default-rtdb.firebaseio.com/'};
  if(withBucket)env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET='demo-config-tests.firebasestorage.app';
  const mocks={
    'firebase/app':{getApps:()=>[],initializeApp:config=>(app=initializeApp(config,'config-test-'+randomUUID()))},
    'firebase/auth':{initializeAuth:()=>({}),getReactNativePersistence:()=>({})},
    'firebase/database':{getDatabase:()=>({})},
    'firebase/storage':storageSDK,
    '@react-native-async-storage/async-storage':{},
  };
  try {
    // Real Storage instance, fake client config; no reads, uploads or credentials.
    runInNewContext(code,{exports,process:{env},require:name=>{assert.ok(name in mocks);return mocks[name];}});
    assert.equal(exports.firebaseConfigured,true);
    if(withBucket){assert.equal(exports.storage.maxUploadRetryTime,30000);assert.equal(exports.storage.maxOperationRetryTime,30000);}
    else assert.equal(exports.storage,null);
  } finally {if(app)await deleteApp(app);}
});
