import { test, expect } from "@jest/globals";
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import * as photo from '../src/utils/photo.js';
const require = createRequire(import.meta.url);
const {
  transformSync
} = require('@babel/core');
const code = transformSync(readFileSync(new URL('../src/services/mediaService.js', import.meta.url), 'utf8'), {
  babelrc: false,
  configFile: false,
  plugins: ['@babel/plugin-transform-modules-commonjs']
}).code;
const jpeg = '/9j/AA==';
function service({
  results = [jpeg],
  exists = true,
  onSave
} = {}) {
  const auth = {
    currentUser: {
      uid: 'owner'
    }
  };
  const calls = {
    sizes: [],
    qualities: [],
    deleted: [],
    released: 0,
    copied: []
  };
  const original = {
    width: 2000,
    height: 4000,
    release: () => calls.released++
  };
  let attempt = 0;
  const mocks = {
    'expo-file-system/legacy': {
      documentDirectory: 'file:///documents/',
      getInfoAsync: async () => ({
        exists,
        size: 15 * 1024 * 1024
      }),
      makeDirectoryAsync: async () => {},
      copyAsync: async value => calls.copied.push(value),
      deleteAsync: async uri => calls.deleted.push(uri)
    },
    'expo-crypto': {
      randomUUID: () => 'photo-id'
    },
    './firebaseConfig': {
      auth
    },
    '../utils/photo': photo,
    'expo-image-manipulator': {
      SaveFormat: {
        JPEG: 'jpeg'
      },
      ImageManipulator: {
        manipulate: input => {
          if (typeof input === 'string') return {
            renderAsync: async () => original
          };
          expect(input).toBe(original);
          return {
            resize: size => {
              calls.sizes.push(size);
              return {
                renderAsync: async () => ({
                  release: () => calls.released++,
                  saveAsync: async options => {
                    expect(options.format).toBe('jpeg');
                    expect(options.base64).toBe(true);
                    calls.qualities.push(options.compress);
                    await onSave?.(auth);
                    return {
                      uri: 'file:///cache/' + attempt + '.jpg',
                      base64: results[attempt++] ?? results.at(-1)
                    };
                  }
                })
              };
            }
          };
        }
      }
    }
  };
  const context = {
    exports: {},
    require: name => {
      expect(name in mocks).toBeTruthy();
      return mocks[name];
    }
  };
  runInNewContext(code, context);
  return {
    api: context.exports,
    auth,
    calls
  };
}
test('foto Base64 distingue URL antiga, JPEG reduzido e caminho local; limita tamanho/formato', () => {
  expect(photo.isSyncedPhoto('https://example.test/photo.jpg')).toBeTruthy();
  expect(photo.isSyncedPhoto(photo.photoDataUri(jpeg))).toBeTruthy();
  expect(photo.isSyncedPhoto('file:///photo.jpg')).toBe(false);
  for (const input of ['', 'iVBORw0KGgo=', '/9j/ AA==', '/9j/A']) expect(() => photo.photoDataUri(input)).toThrow(expect.objectContaining({
    status: 422
  }));
  expect(() => photo.photoDataUri('/9j/' + 'A'.repeat(photo.MAX_PHOTO_LENGTH))).toThrow(expect.objectContaining({
    status: 413
  }));
});
test('foto original permanece local e cópia persistente não depende do cache da câmera', async () => {
  const {
    api,
    calls
  } = service();
  expect(await api.persistPhoto('file:///camera.jpg')).toBe('file:///documents/fotos/photo-id.jpg');
  expect(calls.copied[0].from).toBe('file:///camera.jpg');
  expect(calls.deleted.length).toBe(0);
});
test('imagem grande é reduzida para JPEG Base64 sem Storage e sem apagar original', async () => {
  const {
    api,
    calls
  } = service();
  expect(await api.encodePhotoForSync('file:///original.jpg', 'owner')).toBe(photo.JPEG_PREFIX + jpeg);
  expect(calls.sizes[0].width).toBe(480);
  expect(calls.sizes[0].height).toBe(960);
  expect(calls.qualities[0]).toBe(0.7);
  expect(calls.deleted).toEqual(['file:///cache/0.jpg']);
  expect(calls.released).toBe(2);
});
test('Base64 acima do limite reduz resolução/qualidade até caber; falha final conserva original', async () => {
  const huge = '/9j/' + 'A'.repeat(photo.MAX_PHOTO_LENGTH);
  const {
    api,
    calls
  } = service({
    results: [huge, jpeg]
  });
  await api.encodePhotoForSync('file:///original.jpg', 'owner');
  expect(calls.sizes[1].height).toBe(720);
  expect(calls.qualities).toEqual([0.7, 0.55]);
  const failed = service({
    results: [huge]
  });
  await expect(failed.api.encodePhotoForSync('file:///original.jpg', 'owner')).rejects.toThrow(expect.objectContaining({
    status: 413
  }));
  expect(failed.calls.deleted.length).toBe(3);
  expect(!failed.calls.deleted.includes('file:///original.jpg')).toBeTruthy();
});
test('troca de conta durante preparação descarta resultado e libera temporários', async () => {
  const {
    api,
    calls
  } = service({
    onSave: auth => {
      auth.currentUser = {
        uid: 'other'
      };
    }
  });
  await expect(api.encodePhotoForSync('file:///original.jpg', 'owner')).rejects.toThrow(expect.objectContaining({
    sessionChanged: true
  }));
  expect(calls.deleted.length).toBe(1);
  expect(calls.released).toBe(2);
});
test('arquivo ausente, caminho inválido ou sessão errada não inicia processamento', async () => {
  const missing = service({
    exists: false
  });
  await expect(missing.api.encodePhotoForSync('file:///missing.jpg', 'owner')).rejects.toThrow(expect.objectContaining({
    status: 422
  }));
  const {
    api,
    calls
  } = service();
  await expect(api.encodePhotoForSync('content://photo', 'owner')).rejects.toThrow(expect.objectContaining({
    status: 422
  }));
  await expect(api.encodePhotoForSync('file:///photo.jpg', 'other')).rejects.toThrow(expect.objectContaining({
    sessionChanged: true
  }));
  expect(calls.sizes.length).toBe(0);
});
