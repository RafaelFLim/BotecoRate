import { get, ref } from 'firebase/database';
import { randomUUID } from 'expo-crypto';
import NetInfo from '@react-native-community/netinfo';
import { auth, db, requireFirebase } from './firebaseConfig';
import { getActiveUser } from './authService';
import { podeInteragir } from '../utils/permissoes';
import { listTrashEntries } from './trashEntries';
import { planTrashRestore } from './trashRestore';
import { readDirectState, sendCommand } from './syncTransport';

function session() {
  const user = getActiveUser();
  if (!podeInteragir(user) || auth.currentUser?.uid !== user.id) {
    throw new Error('Entre com uma conta ativa e e-mail verificado para consultar a lixeira.');
  }
  return user.id;
}

export async function loadTrash() {
  requireFirebase();
  const actor = session();
  const read = path => get(ref(db, `v1/${path}`)).then(snapshot => snapshot.val() || {});
  const access = await read(`access_control/${actor}`);
  const admin = access.role === 'admin' && access.status === 'ativo';
  const [direct, accounts, directory] = await Promise.all([
    read('direct'),
    admin ? read('access_control') : {},
    admin ? read('user_directory') : {},
  ]);
  if (session() !== actor || (admin && (accounts[actor]?.role !== 'admin' || accounts[actor]?.status !== 'ativo'))) {
    throw new Error('A sessão ou a permissão mudou. Atualize a lixeira.');
  }
  return { admin, entries: listTrashEntries({ direct, actor, admin, accounts, directory }) };
}

export async function restoreCatalogEntry(type,id) {
  requireFirebase();
  const actor=session();
  const network=await NetInfo.fetch();
  if (!network.isConnected || network.isInternetReachable===false) throw new Error('Conecte-se à internet para restaurar o registro.');
  const [state,access]=await Promise.all([readDirectState(actor),get(ref(db,`v1/access_control/${actor}`))]);
  const command=planTrashRestore(state,{type,id,actor,admin:access.val()?.role==='admin',operationId:randomUUID(),now:Date.now()});
  await sendCommand(actor,command);
}
