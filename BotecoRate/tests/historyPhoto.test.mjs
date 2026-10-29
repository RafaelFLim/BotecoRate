import test from 'node:test';
import assert from 'node:assert/strict';
import { describeHistoryPhoto } from '../src/utils/historyPhoto.js';

test('histórico resume fotos grandes e legadas sem expor conteúdo nem modificar a auditoria', () => {
  const base64 = 'data:image/jpeg;base64,/9j/' + 'A'.repeat(160000);
  const event = Object.freeze({
    before: Object.freeze({ foto: 'https://example.test/foto.jpg?token=privado' }),
    record: Object.freeze({ foto: base64 }),
  });
  assert.equal(describeHistoryPhoto(event.before.foto, event.record.foto), 'Foto substituída');
  assert.equal(describeHistoryPhoto(null, base64), 'Foto adicionada');
  assert.equal(describeHistoryPhoto(base64, null), 'Foto removida');
  assert.equal(describeHistoryPhoto('file:///fotos/antiga.jpg', base64), 'Foto substituída');
  assert.equal(describeHistoryPhoto(base64, base64), '');
  assert.equal(describeHistoryPhoto(undefined, null), '');
  assert.equal(event.record.foto, base64);
  assert.equal(event.before.foto, 'https://example.test/foto.jpg?token=privado');
});
