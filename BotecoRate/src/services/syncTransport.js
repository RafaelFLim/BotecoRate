import { get, ref, update } from 'firebase/database';
import { auth, db } from './firebaseConfig';
import { getActiveUser } from './authService';
import { commandReceipt, planDirectCommand, directError, directSnapshot } from './directProtocol';

export function assertSession(uid) {
  if (getActiveUser()?.id!==uid || getActiveUser()?.origem!=='firebase' || auth?.currentUser?.uid!==uid) {
    throw Object.assign(new Error('A conta mudou durante a sincronização.'),{sessionChanged:true});
  }
}
export async function readDirectState(uid) {
  assertSession(uid);
  const snapshot=await get(ref(db,'v1/direct'));
  assertSession(uid);
  if (!snapshot.exists()) throw new Error('A sincronização direta ainda não foi preparada no Firebase.');
  return snapshot.val();
}
export async function downloadCatalog(uid) { return directSnapshot(await readDirectState(uid)); }
export async function sendCommand(uid,command) {
  const current=await readDirectState(uid);
  const existing=commandReceipt(current,command);
  if (existing) return existing;
  const plan=planDirectCommand(current,command,uid,getActiveUser().usuario);
  assertSession(uid);
  try {
    // Atomic SDK write, protected by remote version/permission/history rules.
    await update(ref(db,'v1/direct'),plan.updates);
  } catch(error) {
    if (String(error.code).toLowerCase().includes('permission')) {
      const fresh=await readDirectState(uid);
      const received=commandReceipt(fresh,command);
      if (received) return received;
      for(const c of command.changes) {
        const record=fresh.entities?.[c.entity_type]?.[c.entity_id];
        if ((record?.version||0)!==c.base_version) throw directError('Outra alteração já foi confirmada.',409,{remote:record||null});
      }
      throw directError('O Firebase recusou a alteração. Confira sua permissão, os dados e as regras publicadas.',403);
    }
    throw error;
  }
  assertSession(uid);
  return plan.receipt;
}
