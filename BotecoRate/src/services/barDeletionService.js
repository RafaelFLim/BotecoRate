import { get, ref, update } from 'firebase/database';
import NetInfo from '@react-native-community/netinfo';
import { auth, db, requireFirebase } from './firebaseConfig';
import { getActiveUser } from './authService';
import { podeInteragir } from '../utils/permissoes';

async function loadState(barId) {
  requireFirebase();
  const user = getActiveUser();
  if (!podeInteragir(user) || auth.currentUser?.uid !== user.id) throw new Error('Entre com uma conta ativa para consultar a exclusão.');
  const network = await NetInfo.fetch();
  if (!network.isConnected || network.isInternetReachable === false) throw new Error('Conecte-se para consultar ou registrar os aceites de exclusão.');
  const state = (await get(ref(db,'v1/direct'))).val() || {};
  if (getActiveUser()?.id !== user.id || auth.currentUser?.uid !== user.id) throw new Error('A conta mudou. Tente novamente.');
  const ownership = state.ownership_state?.[barId];
  if (!ownership || !state.entities?.bares?.[barId] || state.entities.bares[barId].deleted_at ||
      (user.papel!=='admin' && state.owners?.[barId]?.[user.id] !== true)) {
    throw new Error('O bar não está ativo ou seu vínculo mudou.');
  }
  const record = state.bar_deletions?.[barId];
  const epoch = state.ownership_epoch ?? 0;
  const current = record?.ownership_version === ownership.version && record.access_epoch === epoch;
  return { user, ownership, record, epoch, current };
}

export async function loadBarDeletion(barId) {
  const { user, record, current } = await loadState(barId);
  return record && { ...record, stale:!current, mustRespond:current && record.status==='pendente' && record.remaining.includes('|'+user.id+'|') };
}

export async function changeBarDeletion(barId, action, reason) {
  const { user, ownership, record, epoch, current } = await loadState(barId);
  const token = '|' + user.id + '|';
  let remaining;
  let status;
  if (action==='administrativa' && user.papel==='admin') {
    reason=reason.trim();
    if(reason.length<5 || reason.length>500) throw new Error('Informe um motivo de 5 a 500 caracteres.');
    remaining='|';
    status='administrativa';
  } else if (action==='solicitar' && (!current || ['recusada','administrativa'].includes(record?.status))) {
    reason=reason.trim();
    if(reason.length<5 || reason.length>500) throw new Error('Informe um motivo de 5 a 500 caracteres.');
    remaining=ownership.owner_order.replace(token,'|');
    if(remaining==='|') throw new Error('Este bar tem apenas um dono. Use a exclusão direta.');
    status='pendente';
  } else if (current && record.status==='pendente' && record.remaining.includes(token) && ['aceitar','recusar'].includes(action)) {
    remaining=action==='aceitar'?record.remaining.replace(token,'|'):record.remaining;
    status=action==='recusar'?'recusada':remaining==='|'?'aprovada':'pendente';
    reason=record.reason;
  } else throw new Error('A solicitação já foi alterada ou você já respondeu. Atualize a tela.');
  const next={status,remaining,reason,version:(record?.version??0)+1,ownership_version:ownership.version,
    access_epoch:epoch,updated_at:new Date().toISOString(),updated_by:user.id};
  if (getActiveUser()?.id !== user.id || auth.currentUser?.uid !== user.id) throw new Error('A conta mudou. Tente novamente.');
  await update(ref(db,'v1/direct'),{[`bar_deletions/${barId}`]:next,[`bar_deletion_history/${barId}/${next.version}`]:next});
}
