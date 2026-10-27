import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import * as photo from '../src/utils/photo.js';

const require = createRequire(import.meta.url);
const { transformSync } = require('@babel/core');
const code = transformSync(readFileSync(new URL('../src/services/mediaService.js', import.meta.url), 'utf8'), {
  babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-modules-commonjs'],
}).code;
const jpeg = '/9j/AA==';
function service({ results = [jpeg], exists = true, onSave } = {}) {
  const auth = { currentUser: { uid: 'owner' } };
  const calls = { sizes: [], qualities: [], deleted: [], released: 0, copied: [] };
  const original = { width: 2000, height: 4000, release: () => calls.released++ };
  let attempt = 0;
  const mocks = {
    'expo-file-system/legacy': {
      documentDirectory: 'file:///documents/', getInfoAsync: async () => ({ exists, size: 15 * 1024 * 1024 }),
      makeDirectoryAsync: async () => {}, copyAsync: async value => calls.copied.push(value),
      deleteAsync: async uri => calls.deleted.push(uri),
    },
    'expo-crypto': { randomUUID: () => 'photo-id' },
    './firebaseConfig': { auth }, '../utils/photo': photo,
    'expo-image-manipulator': { SaveFormat: { JPEG: 'jpeg' }, ImageManipulator: { manipulate: input => {
      if (typeof input === 'string') return { renderAsync: async () => original };
      assert.equal(input, original);
      return { resize: size => {
        calls.sizes.push(size);
        return { renderAsync: async () => ({ release: () => calls.released++, saveAsync: async options => {
          assert.equal(options.format, 'jpeg'); assert.equal(options.base64, true);
          calls.qualities.push(options.compress);
          await onSave?.(auth);
          return { uri: 'file:///cache/' + attempt + '.jpg', base64: results[attempt++] ?? results.at(-1) };
        } }) };
      } };
    } } },
  };
  const context = { exports: {}, require: name => { assert.ok(name in mocks, name); return mocks[name]; } };
  runInNewContext(code, context);
  return { api: context.exports, auth, calls };
}

test('foto Base64 distingue URL antiga, JPEG reduzido e caminho local; limita tamanho/formato', () => {
  assert.ok(photo.isSyncedPhoto('https://example.test/photo.jpg'));
  assert.ok(photo.isSyncedPhoto(photo.photoDataUri(jpeg)));
  assert.equal(photo.isSyncedPhoto('file:///photo.jpg'), false);
  for (const input of ['', 'iVBORw0KGgo=', '/9j/ AA==', '/9j/A']) assert.throws(() => photo.photoDataUri(input), e => e.status === 422);
  assert.throws(() => photo.photoDataUri('/9j/' + 'A'.repeat(photo.MAX_PHOTO_LENGTH)), e => e.status === 413);
});

test('foto original permanece local e cópia persistente não depende do cache da câmera', async () => {
  const { api, calls } = service();
  assert.equal(await api.persistPhoto('file:///camera.jpg'), 'file:///documents/fotos/photo-id.jpg');
  assert.equal(calls.copied[0].from, 'file:///camera.jpg');
  assert.equal(calls.deleted.length, 0);
});

test('imagem grande é reduzida para JPEG Base64 sem Storage e sem apagar original', async () => {
  const { api, calls } = service();
  assert.equal(await api.encodePhotoForSync('file:///original.jpg', 'owner'), photo.JPEG_PREFIX + jpeg);
  assert.equal(calls.sizes[0].width, 480); assert.equal(calls.sizes[0].height, 960);
  assert.equal(calls.qualities[0], 0.7);
  assert.deepEqual(calls.deleted, ['file:///cache/0.jpg']);
  assert.equal(calls.released, 2);
});

test('Base64 acima do limite reduz resolução/qualidade até caber; falha final conserva original', async () => {
  const huge = '/9j/' + 'A'.repeat(photo.MAX_PHOTO_LENGTH);
  const { api, calls } = service({ results: [huge, jpeg] });
  await api.encodePhotoForSync('file:///original.jpg', 'owner');
  assert.equal(calls.sizes[1].height, 720);
  assert.deepEqual(calls.qualities, [0.7, 0.55]);
  const failed = service({ results: [huge] });
  await assert.rejects(failed.api.encodePhotoForSync('file:///original.jpg', 'owner'), e => e.status === 413);
  assert.equal(failed.calls.deleted.length, 3);
  assert.ok(!failed.calls.deleted.includes('file:///original.jpg'));
});

test('troca de conta durante preparação descarta resultado e libera temporários', async () => {
  const { api, calls } = service({ onSave: auth => { auth.currentUser = { uid: 'other' }; } });
  await assert.rejects(api.encodePhotoForSync('file:///original.jpg', 'owner'), e => e.sessionChanged);
  assert.equal(calls.deleted.length, 1); assert.equal(calls.released, 2);
});

test('arquivo ausente, caminho inválido ou sessão errada não inicia processamento', async () => {
  const missing = service({ exists: false });
  await assert.rejects(missing.api.encodePhotoForSync('file:///missing.jpg', 'owner'), e => e.status === 422);
  const { api, calls } = service();
  await assert.rejects(api.encodePhotoForSync('content://photo', 'owner'), e => e.status === 422);
  await assert.rejects(api.encodePhotoForSync('file:///photo.jpg', 'other'), e => e.sessionChanged);
  assert.equal(calls.sizes.length, 0);
});
