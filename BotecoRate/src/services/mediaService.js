import * as FileSystem from 'expo-file-system/legacy';
import { randomUUID } from 'expo-crypto';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { storage, auth } from './firebaseConfig';

export async function persistPhoto(uri) {
  const directory = `${FileSystem.documentDirectory}fotos/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const destination = `${directory}${randomUUID()}.jpg`;
  await FileSystem.copyAsync({ from: uri, to: destination });
  return destination;
}

export async function uploadPhoto(uri,uid) {
  if (!storage) throw new Error('Configure o Firebase Storage para sincronizar fotos. A foto continua neste aparelho.');
  if (auth?.currentUser?.uid!==uid) throw Object.assign(new Error('A conta mudou.'),{sessionChanged:true});
  if (!uri.startsWith('file://')) throw Object.assign(new Error('Foto local inválida. Tire uma nova foto.'),{status:422});
  const info=await FileSystem.getInfoAsync(uri);
  if (!info.exists) throw Object.assign(new Error('Arquivo da foto não encontrado neste aparelho.'),{status:422});
  if (info.size>5*1024*1024) throw Object.assign(new Error('A foto deve ter até 5 MB.'),{status:413});
  const data=await FileSystem.readAsStringAsync(uri,{encoding:FileSystem.EncodingType.Base64});
  const hash=bytesToHex(sha256(new TextEncoder().encode(data)));
  const object=ref(storage,`catalog/${uid}/${hash}.jpg`);
  // Reuse content-addressed uploads after a retry or a second queued edit.
  // Storage rules intentionally disallow overwriting an existing object.
  let url;
  try { url=await getDownloadURL(object); }
  catch(error) {
    if (error.code!=='storage/object-not-found') throw error;
    try { await uploadString(object,data,'base64',{contentType:'image/jpeg'}); }
    catch(uploadError) {
      // Another attempt may have created the same object concurrently.
      if (uploadError.code!=='storage/unauthorized') throw uploadError;
    }
    url=await getDownloadURL(object);
  }
  if (auth?.currentUser?.uid!==uid) throw Object.assign(new Error('A conta mudou.'),{sessionChanged:true});
  return url;
}
