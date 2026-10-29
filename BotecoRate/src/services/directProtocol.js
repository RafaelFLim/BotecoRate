// Pure protocol: used by the Firebase SDK transport and emulator tests.
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
const fingerprint = command => bytesToHex(sha256(new TextEncoder().encode(JSON.stringify(command))));
export const TABLES = ['bares', 'itens_cardapio', 'avaliacoes_bares', 'avaliacoes_itens'];
const fields = {
  bares: ['nome','endereco','cep','detalhes','foto','latitude','longitude','criado_por'],
  itens_cardapio: ['bar_id','tipo','nome','descricao','valor_centavos','foto'],
  avaliacoes_bares: ['bar_id','autor_id','autor_nome','nota','comentario','elegivel_ranking'],
  avaliacoes_itens: ['item_id','autor_id','autor_nome','nota','comentario','elegivel_ranking'],
};
export const asMap = value => Object.fromEntries(Object.entries(value || {}).filter(([,v]) => v != null));
export function directError(message, status = 422, body = {}) {
  return Object.assign(new Error(message), { status, body });
}
export function commandReceipt(state, command) {
  const changes = [];
  const hash=fingerprint(command);
  for (const c of command.changes) {
    const entry = state.history?.[c.entity_type]?.[c.entity_id]?.[String(c.base_version + 1)];
    if (!entry || entry.operation_id !== command.operation_id) return null;
    if (entry.command_hash!==hash) throw directError('Identificador de envio reutilizado com conteúdo diferente.',409);
    changes.push({entity_type:c.entity_type,entity_id:c.entity_id,operation:entry.operation,record:entry.record,before:entry.before,actor_uid:entry.actor_uid});
  }
  return {operation_id:command.operation_id,changes};
}
export function planDirectCommand(state, command, uid, name, now = new Date().toISOString()) {
  if (command.protocol !== 1 || !Array.isArray(command.changes) || !command.changes.length || command.changes.length > 200) throw directError('Comando inválido.');
  const entities = Object.fromEntries(TABLES.map(t => [t,JSON.parse(JSON.stringify(asMap(state.entities?.[t])))]));
  const updates = {};
  const changes = [];
  const seen = new Set();
  for (const c of command.changes) {
    if (!TABLES.includes(c.entity_type) || !/^[A-Za-z0-9_-]{1,128}$/.test(c.entity_id) || seen.has(c.entity_type+':'+c.entity_id)) throw directError('Entidade inválida ou repetida.');
    seen.add(c.entity_type+':'+c.entity_id);
    const old = entities[c.entity_type][c.entity_id] || null;
    if ((old?.version || 0) !== c.base_version || old?.deleted_at || (c.operation === 'create') !== !old) {
      throw directError('Outra versão foi confirmada. Revise sua alteração.',409,{remote:old});
    }
    if (!['create','update','soft_delete'].includes(c.operation)) throw directError('Operação inválida.');
    const row = Object.fromEntries(fields[c.entity_type].map(f => [f, (c.operation === 'soft_delete' ? old : c.payload)?.[f] ?? null]));
    if (c.entity_type === 'bares') row.criado_por = old?.criado_por || uid;
    // Clientes antigos não enviavam CEP. Nunca associar CEP antigo a outro endereço.
    if (c.entity_type === 'bares' && c.operation !== 'soft_delete' && !Object.hasOwn(c.payload || {}, 'cep')) row.cep = old?.endereco === row.endereco ? old?.cep ?? null : null;
    if (c.entity_type.startsWith('avaliacoes_')) {
      row.autor_id = old ? old.autor_id ?? null : uid;
      row.autor_nome = old?.autor_nome || name;
      row.elegivel_ranking = old ? old.elegivel_ranking : 1;
    }
    Object.assign(row,{id:c.entity_id,created_at:old?.created_at || now,updated_at:now,
      deleted_at:c.operation === 'soft_delete' ? now : null,version:c.base_version+1,last_operation:command.operation_id});
    entities[c.entity_type][c.entity_id] = row;
    changes.push({entity_type:c.entity_type,entity_id:c.entity_id,operation:c.operation,record:row,before:old,actor_uid:uid});
  }
  // Every affected active bar carries three distinct, active menu references.
  const bars = new Set(changes.flatMap(c => c.entity_type==='bares' ? [c.entity_id] : c.entity_type==='itens_cardapio' ? [c.record.bar_id] : []));
  for (const id of bars) {
    const bar = entities.bares[id];
    if (!bar || bar.deleted_at) continue;
    const items = Object.values(entities.itens_cardapio).filter(i => i.bar_id===id && !i.deleted_at).map(i=>i.id).sort();
    if (items.length < 3) throw directError('O bar deve manter pelo menos três itens ativos.');
    const anchors = {item_a:items[0],item_b:items[1],item_c:items[2]};
    const changed = changes.find(c=>c.entity_type==='bares' && c.entity_id===id);
    if (changed) Object.assign(bar,anchors);
    else {
      const old = asMap(state.entities?.bares)[id];
      if (['item_a','item_b','item_c'].some(k=>old[k]!==anchors[k])) {
        const row = {...old,...anchors,version:old.version+1,updated_at:now,last_operation:command.operation_id};
        entities.bares[id] = row;
        changes.push({entity_type:'bares',entity_id:id,operation:'update',record:row,before:old,actor_uid:uid});
      }
    }
  }
  for (const c of changes) {
    const {entity_type:t,entity_id:id,record:row} = c;
    updates[`entities/${t}/${id}`] = row;
    updates[`history/${t}/${id}/${row.version}`] = {actor_uid:uid,operation_id:command.operation_id,command_hash:fingerprint(command),
      operation:c.operation,before:c.before || {absent:true},record:row};
    if (t==='bares') {
      if (!c.before) {
        updates[`owners/${id}/${uid}`] = true;
        updates[`ownership_state/${id}`]={version:0,owner_order:'|'+uid+'|',updated_at:now,updated_by:uid};
      }
      updates[`public_bars/${id}`] = Object.fromEntries(['id','nome','endereco','foto','latitude','longitude','deleted_at','version'].map(k=>[k,row[k]??null]));
    }
    if (t.startsWith('avaliacoes_') && !row.deleted_at) {
      const target = row[t==='avaliacoes_bares'?'bar_id':'item_id'];
      updates[`review_index/${t}/${target}/${row.autor_id}`] = id;
    }
  }
  return {updates,receipt:{operation_id:command.operation_id,changes}};
}

export function directSnapshot(state) {
  const entities = Object.fromEntries(TABLES.map(t => [t,asMap(state.entities?.[t])]));
  for (const bar of Object.values(entities.bares)) bar.proprietarios = Object.keys(asMap(state.owners?.[bar.id])).filter(uid=>state.owners[bar.id][uid]===true);
  const history = [];
  for (const t of TABLES) for (const [id,versions] of Object.entries(asMap(state.history?.[t]))) {
    for (const h of Object.values(asMap(versions))) history.push({entity_type:t,entity_id:id,...h});
  }
  return {protocol:1,sequence:0,entities,history,moderation:state.moderation||{},moderationHistory:state.moderation_history||{},ownershipRequests:state.ownership_requests||{},ownershipHistory:state.ownership_history||{}};
}
