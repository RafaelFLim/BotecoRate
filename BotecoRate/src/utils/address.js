export const ADDRESS_FIELDS = ['logradouro','numero','complemento','bairro','cidade','uf'];
export const BRAZIL_UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
export function addressFields(value = {}) {
  return Object.fromEntries(ADDRESS_FIELDS.map(field => [field, value[field] || '']));
}
export function formatAddress(fields) {
  const f = Object.fromEntries(ADDRESS_FIELDS.map(field => [field, String(fields[field] || '').trim()]));
  const street = [f.logradouro,f.numero,f.complemento].filter(Boolean).join(', ');
  return [street,f.bairro,f.cidade,f.uf].filter(Boolean).join(' - ');
}
export function validateAddress(fields) {
  for (const [field,label] of [['logradouro','Rua / logradouro'],['numero','Número (ou S/N)'],['cidade','Cidade']]) {
    if (!fields[field]?.trim()) throw new Error(`Preencha o campo ${label} do endereço.`);
  }
  if (!BRAZIL_UFS.includes(fields.uf)) throw new Error('Escolha uma UF válida para o endereço.');
}
