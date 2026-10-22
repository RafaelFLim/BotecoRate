import * as FileSystem from 'expo-file-system/legacy';
import { randomUUID } from 'expo-crypto';

export async function persistPhoto(uri) {
  const directory = `${FileSystem.documentDirectory}fotos/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const destination = `${directory}${randomUUID()}.jpg`;
  await FileSystem.copyAsync({ from: uri, to: destination });
  return destination;
}
