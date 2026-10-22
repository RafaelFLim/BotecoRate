import { getRandomBytesAsync } from 'expo-crypto';
import { bytesToHex } from '@noble/hashes/utils.js';
import { derivePassword, equalHash, PASSWORD_ITERATIONS } from '../utils/passwordHash';

export async function hashPassword(password, saltHex, iterations = PASSWORD_ITERATIONS) {
  const salt = saltHex || bytesToHex(await getRandomBytesAsync(16));
  return { hash: await derivePassword(password, salt, iterations), salt, iterations };
}
export async function verifyPassword(password, account) {
  const { hash } = await hashPassword(password, account.salt, account.iterations);
  return equalHash(hash, account.password_hash);
}
