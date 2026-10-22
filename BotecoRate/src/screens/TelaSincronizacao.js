import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Formulario, Botao, Aviso } from '../components/Formulario';
import { writeTransaction } from '../database/database';
import { getActiveUser } from '../services/authService';
import { descartarAlteracoesPendentes } from '../services/storage';

export default function TelaSincronizacao({onVoltar, onSincronizar}) {
  const [batches, setBatches] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const uid = getActiveUser()?.id;
  async function load() {
    setBatches(await writeTransaction(tx => tx.getAllAsync('SELECT b.*,c.remote_json FROM sync_batches b LEFT JOIN sync_conflicts c ON c.operation_id=b.operation_id WHERE b.account_uid=? ORDER BY b.rowid', uid || '')));
  }
  useEffect(() => { load().catch(e=>setError(e.message)); }, [uid]);
  async function run(action) {
    setBusy(true); setError('');
    try { await action(); await load(); } catch(e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <Formulario title="Sincronização" onVoltar={onVoltar}>
    <Aviso>Alterações ficam neste aparelho até a confirmação do servidor. Um conflito preserva sua proposta e interrompe os envios seguintes.</Aviso>
    {error ? <Aviso>{error}</Aviso> : null}
    <Botao disabled={busy} onPress={()=>run(onSincronizar)}>Tentar sincronizar</Botao>
    {!batches.length && <Aviso>Nenhum envio pendente nesta conta.</Aviso>}
    {batches.map(batch=><View key={batch.operation_id} style={{paddingVertical:12,gap:8}}>
      <Text style={{fontWeight:'bold'}}>{batch.status} · {batch.attempts} tentativa(s)</Text>
      {batch.last_error && <Text>{batch.last_error}</Text>}
      {JSON.parse(batch.payload).changes.map((c,index)=><View key={index}>
        <Text>{c.entity_type} · {c.operation} · base {c.base_version}</Text>
        <Text selectable>{JSON.stringify(c.payload, null, 2)}</Text>
      </View>)}
      {batch.remote_json && <><Text style={{fontWeight:'bold'}}>Resposta do servidor</Text><Text selectable>{JSON.stringify(JSON.parse(batch.remote_json),null,2)}</Text></>}
    </View>)}
    {!!batches.length && <Botao disabled={busy} secondary onPress={()=>Alert.alert('Usar a versão do servidor?', 'Todas as alterações pendentes desta conta sairão da fila e da visualização. Copie o texto que quiser reaplicar antes de continuar. O registro local de revisão será preservado.',[
      {text:'Cancelar',style:'cancel'},
      {text:'Usar servidor',style:'destructive',onPress:()=>run(async()=>{await descartarAlteracoesPendentes();await onSincronizar();})},
    ])}>Descartar pendências e usar servidor</Botao>}
  </Formulario>;
}
