export function normalizeCnpj(value) {
  return String(value ?? '').trim().replace(/[./-]/g, '').toUpperCase();
}

export function isValidCnpj(value) {
  const cnpj = normalizeCnpj(value);
  if (!/^[A-Z0-9]{12}[0-9]{2}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  const digit = (text, weights) => {
    const remainder = [...text].reduce((sum, char, index) => sum + (char.charCodeAt(0) - 48) * weights[index], 0) % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const base = cnpj.slice(0, 12);
  const weights = [5,4,3,2,9,8,7,6,5,4,3,2];
  const first = digit(base, weights);
  return cnpj === base + first + digit(base + first, [6, ...weights]);
}

export function ownerApprovalUpdates(uid, record) {
  return { [`owner_approvals/${uid}`]: record, [`owner_approval_history/${uid}/${record.version}`]: record };
}
