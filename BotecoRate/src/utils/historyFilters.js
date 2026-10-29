export const normalizeSearch = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
export const normalizedCep = value => /^\d{5}-?\d{3}$/.test(String(value ?? '').trim()) ? String(value).trim().replace('-', '') : null;

// Índice de contexto descartável; não altera snapshots nem infere CEP pela rua.
export function attachHistoryContexts(events, direct = {}) {
  const bars = new Map(), items = new Map();
  const getBar = id => {
    if (!bars.has(id)) bars.set(id, { id, names: new Set(), addresses: new Set(), ceps: new Set(), owners: new Set() });
    return bars.get(id);
  };
  function index(table, id, row) {
    if (!row || row.absent) return;
    if (table === 'bares') {
      const bar = getBar(id);
      if (row.nome) bar.names.add(row.nome);
      if (row.endereco) bar.addresses.add(row.endereco);
      const cep = normalizedCep(row.cep);
      if (cep) bar.ceps.add(cep);
    }
    if (table === 'itens_cardapio' && row.bar_id) items.set(id, row.bar_id);
  }
  for (const table of ['bares', 'itens_cardapio']) {
    for (const [id, row] of Object.entries(direct.entities?.[table] || {})) index(table, id, row);
    for (const [id, versions] of Object.entries(direct.history?.[table] || {})) for (const event of Object.values(versions || {})) {
      index(table, id, event?.before); index(table, id, event?.record);
    }
  }
  for (const [id, owners] of Object.entries(direct.owners || {})) for (const [uid, owns] of Object.entries(owners || {})) if (owns === true) getBar(id).owners.add(uid);
  for (const [id, requests] of Object.entries(direct.ownership_history || {})) for (const versions of Object.values(requests || {})) for (const event of Object.values(versions || {})) {
    if (event?.record?.status === 'concluida') for (const uid of event.record.required_order.split('|').filter(Boolean)) getBar(id).owners.add(uid);
  }
  const contexts = new Map([...bars].map(([id, b]) => [id, Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v instanceof Set ? [...v] : v]))]));
  return events.map(event => {
    const row = direct.entities?.[event.entity_type]?.[event.entity_id] || event.record || {};
    const barId = event.entity_type === 'bares' ? event.entity_id : event.bar_id || row.bar_id || event.record?.bar_id || items.get(row.item_id || event.record?.item_id);
    return { ...event, bar_context: contexts.get(barId) || null };
  });
}

export function matchesHistoryContext(event, filters, users = []) {
  const bar = event.bar_context;
  const contains = (values, query) => values.some(value => normalizeSearch(value).includes(normalizeSearch(query)));
  if (normalizeSearch(filters.bar) && (!bar || (normalizeSearch(bar.id) !== normalizeSearch(filters.bar) && !contains(bar.names, filters.bar)))) return false;
  if (normalizeSearch(filters.owner) && (!bar || !bar.owners.some(uid => normalizeSearch(uid) === normalizeSearch(filters.owner) || contains([users.find(u => u.uid === uid)?.name], filters.owner)))) return false;
  if (filters.address && (!bar || !contains(bar.addresses, filters.address))) return false;
  if (filters.cep && (!bar || !normalizedCep(filters.cep) || !bar.ceps.includes(normalizedCep(filters.cep)))) return false;
  if (filters.withoutCep && (!bar || bar.ceps.length)) return false;
  return true;
}

export function orderHistory(events) {
  const key = event => `${event.entity_type}:${event.operation || ''}:${event.bar_id || event.record?.bar_id || ''}:${event.entity_id}:${event.record?.version || 0}`;
  return [...events].sort((a, b) => String(b.record?.updated_at || '').localeCompare(String(a.record?.updated_at || '')) || key(a).localeCompare(key(b)));
}
