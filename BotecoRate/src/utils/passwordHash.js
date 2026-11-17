import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';

// Conta local acadêmica, somente consulta. Custo reduzido para Expo Go/Hermes;
// não é o parâmetro recomendado para senhas de contas de produção.
// A verificação sempre usa o custo salvo em cada conta, inclusive as antigas.
export const PASSWORD_ITERATIONS = 10000;
export async function derivePassword(password, saltHex, iterations = PASSWORD_ITERATIONS) {
  const digest = await pbkdf2Async(sha256, password, hexToBytes(saltHex), { c: iterations, dkLen: 32, asyncTick: 10 });
  return bytesToHex(digest);
}
export function equalHash(a, b) {
  let difference = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
