import policy from '../constants/usernamePolicy.cjs';

const accented = policy.folds.map(([letters]) => letters + letters.toUpperCase()).join('');
const allowed = new RegExp(`^[A-Za-z${accented}0-9 ._'\\-]+$`);
export function usernameKey(value) {
  let key = String(value ?? '').normalize('NFC').toLowerCase();
  for (const [letters, replacement] of policy.folds) for (const letter of letters) key = key.split(letter).join(replacement);
  return key.replace(/[^a-z0-9]/g, '');
}
export function validatedUsername(value, previous) {
  const name = String(value ?? '').normalize('NFC').trim().replace(/ +/g, ' ');
  if (!name) throw new Error('Informe seu nome de usuário.');
  if (name.length > policy.maxLength) throw new Error('Use no máximo 100 caracteres no nome de usuário.');
  if (!allowed.test(name)) throw new Error('Use letras, números, espaços, pontos, hífen, apóstrofo ou sublinhado. Emojis e outros símbolos não são permitidos.');
  const key = usernameKey(name);
  if ((key.match(/[a-z]/g) || []).length < 3) throw new Error('O nome de usuário precisa conter pelo menos 3 letras. Números e pontuação não contam como letras.');
  if (previous !== undefined && key === usernameKey(previous)) throw new Error('Escolha um nome diferente do nome atual.');
  return name;
}
