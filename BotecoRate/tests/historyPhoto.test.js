import { test, expect } from "@jest/globals";
import { describeHistoryPhoto } from '../src/utils/historyPhoto.js';
test('histórico resume fotos grandes e legadas sem expor conteúdo nem modificar a auditoria', () => {
  const base64 = 'data:image/jpeg;base64,/9j/' + 'A'.repeat(160000);
  const event = Object.freeze({
    before: Object.freeze({
      foto: 'https://example.test/foto.jpg?token=privado'
    }),
    record: Object.freeze({
      foto: base64
    })
  });
  expect(describeHistoryPhoto(event.before.foto, event.record.foto)).toBe('Foto substituída');
  expect(describeHistoryPhoto(null, base64)).toBe('Foto adicionada');
  expect(describeHistoryPhoto(base64, null)).toBe('Foto removida');
  expect(describeHistoryPhoto('file:///fotos/antiga.jpg', base64)).toBe('Foto substituída');
  expect(describeHistoryPhoto(base64, base64)).toBe('');
  expect(describeHistoryPhoto(undefined, null)).toBe('');
  expect(event.record.foto).toBe(base64);
  expect(event.before.foto).toBe('https://example.test/foto.jpg?token=privado');
});
