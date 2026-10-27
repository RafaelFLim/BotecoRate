import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import * as photo from '../src/utils/photo.js';

const require = createRequire(import.meta.url), { transformSync } = require('@babel/core');
const source = readFileSync(new URL('../src/services/syncService.js', import.meta.url), 'utf8');
const { code } = transformSync(source + '\nexport { freezeCommand };', {
  configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs'],
});
function pipeline(onEncode) {
  const state = { uid: 'owner', encoded: 0, writes: [], result: photo.JPEG_PREFIX + '/9j/AA==' };
  const assertSession = uid => { if (state.uid !== uid) throw Object.assign(new Error('A conta mudou.'), { sessionChanged: true }); };
  const mocks = {
    '@react-native-community/netinfo': {}, 'firebase/database': {}, 'expo-crypto': {},
    './firebaseConfig': {}, './storage': {}, '../database/syncStore': {}, './directProtocol': {},
    './authService': { getActiveUser: () => ({ id: state.uid }) }, '../utils/photo': photo,
    './syncTransport': { assertSession },
    '../database/database': { writeTransaction: fn => fn({ runAsync: async (...args) => state.writes.push(args) }) },
    './mediaService': { encodePhotoForSync: async () => { state.encoded++; await onEncode?.(state); return state.result; } },
  };
  const context = { exports: {}, require: name => { assert.ok(name in mocks, name); return mocks[name]; } };
  runInNewContext(code, context);
  return { freeze: context.exports.freezeCommand, state };
}
const batch = photos => ({ operation_id: 'op', payload: JSON.stringify({ protocol: 1, changes: photos.map(foto => ({ operation: 'update', payload: { foto } })) }) });

test('fila congela Base64 uma vez por arquivo; reenvio reaproveita conteúdo e mantém URLs antigas', async () => {
  const { freeze, state } = pipeline();
  const b = batch(['file:///original.jpg', 'file:///original.jpg', 'https://example.test/old.jpg', state.result]);
  const result = await freeze(b, 'owner');
  assert.equal(state.encoded, 1);
  assert.equal(result.changes[0].payload.foto, state.result);
  assert.equal(result.changes[1].payload.foto, state.result);
  assert.equal(result.changes[2].payload.foto, 'https://example.test/old.jpg');
  b.wire_payload = state.writes[0][1];
  state.result = photo.JPEG_PREFIX + '/9j/AQ==';
  const retry = await freeze(b, 'owner');
  assert.equal(JSON.stringify(retry), JSON.stringify(result));
  assert.equal(state.encoded, 1); assert.equal(state.writes.length, 1);
});

test('troca de conta durante conversão não congela foto na fila de outra sessão', async () => {
  const { freeze, state } = pipeline(state => { state.uid = 'other'; });
  await assert.rejects(freeze(batch(['file:///original.jpg']), 'owner'), e => e.sessionChanged);
  assert.equal(state.writes.length, 0);
});
