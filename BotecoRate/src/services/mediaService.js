import * as FileSystem from 'expo-file-system/legacy';
import { randomUUID } from 'expo-crypto';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { auth } from './firebaseConfig';
import { photoDataUri } from '../utils/photo';

export async function persistPhoto(uri) {
  const directory = `${FileSystem.documentDirectory}fotos/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const destination = `${directory}${randomUUID()}.jpg`;
  await FileSystem.copyAsync({ from: uri, to: destination });
  return destination;
}

function assertPhotoSession(uid) {
  if (!uid || auth?.currentUser?.uid !== uid) throw Object.assign(new Error('A conta mudou.'), { sessionChanged: true });
}

// Only the compact JPEG is synchronized. The original local photo is retained.
export async function encodePhotoForSync(uri, uid) {
  assertPhotoSession(uid);
  if (typeof uri !== 'string' || !uri.startsWith('file://')) throw Object.assign(new Error('Foto local inválida. Tire uma nova foto.'),{status:422});
  const info=await FileSystem.getInfoAsync(uri);
  if (!info.exists) throw Object.assign(new Error('Arquivo da foto não encontrado neste aparelho.'),{status:422});
  assertPhotoSession(uid);
  let original;
  try {
    original = await ImageManipulator.manipulate(uri).renderAsync();
    assertPhotoSession(uid);
    for (const [edge, quality] of [[960, 0.7], [720, 0.55], [480, 0.4]]) {
      const scale = Math.min(1, edge / Math.max(original.width, original.height));
      let resized;
      let result;
      try {
        resized = await ImageManipulator.manipulate(original).resize({
          width: Math.max(1, Math.round(original.width * scale)),
          height: Math.max(1, Math.round(original.height * scale)),
        }).renderAsync();
        result = await resized.saveAsync({ format: SaveFormat.JPEG, compress: quality, base64: true });
        assertPhotoSession(uid);
        try { return photoDataUri(result.base64); }
        catch (error) { if (error.status !== 413 || edge === 480) throw error; }
      } finally {
        resized?.release?.();
        if (result?.uri && result.uri !== uri) await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => {});
      }
    }
  } catch (error) {
    if (error.sessionChanged || error.status) throw error;
    throw Object.assign(new Error('Não foi possível preparar esta foto. Ela continua neste aparelho; tire outra foto para tentar novamente.'), { status: 422 });
  } finally {
    original?.release?.();
  }
}
