import { podeGerenciarBar } from './permissoes.js';

export const BAR_EDIT_FIELDS = ['nome', 'endereco', 'cep', 'detalhes', 'foto', 'latitude', 'longitude'];

export function validateBarData(bar) {
  if (bar.cep != null && (typeof bar.cep !== 'string' || !/^\d{8}$/.test(bar.cep))) throw new Error('Informe um CEP com oito números ou deixe o campo vazio.');
  for (const [field, limit, label] of [['nome', 150, 'nome'], ['endereco', 500, 'endereço'], ['detalhes', 5000, 'detalhes']]) {
    if (typeof bar[field] !== 'string' || !bar[field].trim() || bar[field].length > limit) {
      throw new Error(`Preencha ${label} com até ${limit} caracteres.`);
    }
  }
  if (typeof bar.foto !== 'string' || !bar.foto.trim()) throw new Error('O bar precisa de uma foto.');
  const { latitude: lat, longitude: lng } = bar;
  if (!((lat == null && lng == null) || (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180))) {
    throw new Error('Informe uma posição válida para o mapa ou remova a localização.');
  }
}

function currentBar(catalog, id, baseline, user) {
  const bar = catalog.find(entry => entry.id === id);
  if (!bar) throw new Error('Este bar foi excluído ou não está mais disponível.');
  if (!podeGerenciarBar(user, bar)) throw new Error('Você não tem mais permissão para gerenciar este bar.');
  if (!baseline || bar.version !== baseline.version || BAR_EDIT_FIELDS.some(field => (bar[field] ?? null) !== (baseline[field] ?? null))) {
    throw new Error('Os dados do bar mudaram enquanto esta tela estava aberta. Volte e abra o gerenciamento novamente para revisar a versão atual.');
  }
  return bar;
}

export function prepareBarEdit(catalog, id, patch, baseline, user) {
  const bar = currentBar(catalog, id, baseline, user);
  const data = Object.fromEntries(BAR_EDIT_FIELDS.map(field => [field, patch[field] ?? null]));
  for (const field of ['nome', 'endereco', 'detalhes']) if (typeof data[field] === 'string') data[field] = data[field].trim();
  validateBarData(data);
  return catalog.map(entry => entry.id === id ? { ...bar, ...data } : entry);
}

export function prepareBarDeletion(catalog, id, baseline, user) {
  currentBar(catalog, id, baseline, user);
  return catalog.filter(entry => entry.id !== id);
}
