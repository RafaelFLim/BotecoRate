import { isValidCnpj, normalizeCnpj } from './ownerApprovalProtocol.js';

export function availableCnpjs(initial, extras, usage, localPending = []) {
  if (initial?.status !== 'aprovada') return [];
  const unavailable = cnpj => Boolean(usage[cnpj]) || localPending.includes(cnpj);
  if (!unavailable(initial.cnpj)) return [initial.cnpj];
  return Object.keys(extras).filter(cnpj=>extras[cnpj].status==='aprovada'&&!unavailable(cnpj)).sort();
}

export function normalizeCnpjBatch(values) {
  if (!values.length || values.length > 20 || values.some(value=>!isValidCnpj(value))) {
    throw new Error('Informe de 1 a 20 CNPJs válidos. Confira todos os campos.');
  }
  const cnpjs=values.map(normalizeCnpj);
  if (new Set(cnpjs).size!==cnpjs.length) throw new Error('Cada CNPJ deve aparecer apenas uma vez.');
  return cnpjs;
}

export function writeCnpjDecision(updates, uid, cnpj, record) {
  updates[`owner_cnpjs/${uid}/${cnpj}`]=record;
  updates[`owner_cnpj_history/${uid}/${cnpj}/${record.version}`]=record;
}
