import limits from '../constants/photoLimits.cjs';

export const JPEG_PREFIX = 'data:image/jpeg;base64,';
export const MAX_PHOTO_LENGTH = limits.maxDataUriLength;
export function isSyncedPhoto(value) {
  return typeof value === 'string' && (/^https:\/\//.test(value) || value.startsWith(JPEG_PREFIX));
}
export function photoDataUri(base64) {
  if (typeof base64 !== 'string' || base64.length % 4 !== 0 || !/^\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
    throw Object.assign(new Error('Não foi possível preparar a foto. Tire uma nova foto e tente novamente.'), { status: 422 });
  }
  const uri = JPEG_PREFIX + base64;
  if (uri.length > MAX_PHOTO_LENGTH) throw Object.assign(new Error('A foto ficou grande demais. Tire outra foto mais simples e tente novamente.'), { status: 413 });
  return uri;
}
