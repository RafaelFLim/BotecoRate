import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { Aviso, Botao, Campo, Formulario, OpcaoConta } from '../components/Formulario';
import ListaPaginada from '../components/ListaPaginada';
import { changeUserAccess, moderateReview } from '../services/adminService';
import { loadTrash, restoreCatalogEntry } from '../services/trashService';
import { normalizeSearch } from '../utils/historyFilters';

const matches = (values, query) => values.some(value => normalizeSearch(value).includes(normalizeSearch(query)));
const date = value => new Date(value).toLocaleString('pt-BR');

export default function TelaLixeira({ onVoltar, onAtualizarCatalogo }) {
  const [data, setData] = useState(null);
  const [query, setQuery] = useState('');
  const [actor, setActor] = useState('');
  const [type, setType] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [selected, setSelected] = useState(null);
  const [reason, setReason] = useState('');

  async function refresh() {
    setBusy(true);
    setError('');
    setData(null);
    try { setData(await loadTrash()); }
    catch (e) { setError(`Não foi possível consultar a lixeira. ${e.message}`); }
    finally { setBusy(false); }
  }
  useEffect(() => { refresh(); }, []);

  async function restore() {
    setBusy(true);
    setError('');
    try {
      if (selected.restoreAction === 'catalogo') await restoreCatalogEntry(selected.type,selected.id);
      else if (selected.type === 'usuarios') await changeUserAccess(selected.id, selected.restoreAction, reason);
      else await moderateReview(selected.type, selected.id, selected.restoreAction, reason);
      setSelected(null);
      await refresh();
      await onAtualizarCatalogo();
    } catch (e) {
      setError(`Não foi possível concluir a operação. ${e.message}`);
      setBusy(false);
    }
  }

  const entries = data?.entries || [];
  const types = [...new Map(entries.map(entry => [entry.type, entry.typeLabel]))];
  const filtered = entries.filter(entry => matches([entry.title, entry.id, entry.typeLabel], query) &&
    (!type || entry.type === type) && (!data.admin || !actor || matches([entry.deletedBy, entry.deletedByName], actor)));
  const expired = Number.isFinite(selected?.deadline) && Date.now() >= selected.deadline;
  return <Formulario title="Lixeira" error={error} onVoltar={selected ? () => { setSelected(null); setError(''); } : onVoltar}>
    {selected ? <>
      <Aviso>{selected.typeLabel} · {selected.title}</Aviso>
      {data?.admin && <Aviso>Excluído por {selected.deletedByName || 'responsável indisponível'}.</Aviso>}
      <Aviso>Excluído em {date(selected.deletedAt)}.{Number.isFinite(selected.deadline) && ` ${expired ? 'Prazo vencido em' : 'Prazo na lixeira até'} ${date(selected.deadline)}.`}</Aviso>
      {!selected.restoreAction && !expired && <Aviso>A restauração não está disponível para este registro.</Aviso>}
      {selected.restoreAction && !expired && <>
        {selected.restoreAction !== 'catalogo' && <Campo label="Justificativa obrigatória" value={reason} onChangeText={setReason} multiline maxLength={500} editable={!busy}/>}
        <Botao disabled={busy || (selected.restoreAction !== 'catalogo' && reason.trim().length < 5)} onPress={() => Alert.alert('Restaurar registro?', selected.title, [
          { text:'Cancelar', style:'cancel' }, { text:'Restaurar', onPress:restore },
        ])}>Restaurar</Botao>
      </>}
    </> : <>
      <Aviso>{data?.admin ? 'Visão administrativa de todos os registros excluídos.' : 'Aqui aparecem os registros excluídos por você.'} O prazo da lixeira é de 30 dias.</Aviso>
      <Botao secondary disabled={busy} onPress={refresh}>{busy ? 'Carregando…' : 'Atualizar lixeira'}</Botao>
      <Campo label="Buscar por nome, tipo ou ID do registro" value={query} onChangeText={setQuery}/>
      {data?.admin && <Campo label="Filtrar por quem excluiu (nome ou UID)" value={actor} onChangeText={setActor}/>}
      {(types.length > 1 || Boolean(type)) && <>
        <Botao secondary={Boolean(type)} onPress={() => setType('')}>Todos os tipos</Botao>
        {types.map(([key, label]) => <Botao key={key} secondary={type !== key} onPress={() => setType(key)}>{label}</Botao>)}
      </>}
      {data && <ListaPaginada items={filtered} resetKey={JSON.stringify([query, actor, type])}
        empty="Nenhum registro encontrado na lixeira." renderItem={entry => <OpcaoConta key={entry.key} title={entry.title}
          description={`${entry.typeLabel} · ${date(entry.deletedAt)}${data.admin ? ` · ${entry.deletedByName || 'Responsável indisponível'}` : ''}`}
          onPress={() => { setSelected(entry); setReason(''); setError(''); }}/>} />}
    </>}
  </Formulario>;
}
