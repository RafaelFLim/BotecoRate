import { useEffect, useState } from 'react';
import { Alert, Linking } from 'react-native';
import { Aviso, Botao, Campo, Formulario, OpcaoConta } from '../components/Formulario';
import ListaPaginada from '../components/ListaPaginada';
import { isValidCnpj } from '../services/ownerApprovalProtocol';
import { decideOwnerApproval, loadOwnerApprovals, submitOwnerApproval } from '../services/ownerApprovalService';
import { normalizeSearch } from '../utils/historyFilters';

const labels = {pendente:'Em análise',aprovada:'Aprovada',recusada:'Recusada',revogada:'Revogada'};
const receipt = 'https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/Cnpjreva_S.aspx';

export default function TelaValidacaoDono({ admin = false, onVoltar, onCnpjsAdicionais }) {
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [business, setBusiness] = useState('');
  const [reason, setReason] = useState('');
  const [query, setQuery] = useState('');
  const [showCnpjError, setShowCnpjError] = useState(false);

  async function run(action) {
    setBusy(true);
    setError('');
    try {
      await action?.();
      setRows(await loadOwnerApprovals(admin));
    } catch (e) {
      setError(/permission[\s_-]+denied/i.test(e.code || e.message || '')
        ? 'Não foi possível acessar a validação de donos. Confirme seu e-mail, entre novamente e tente atualizar. Se persistir, avise a administração.'
        : e.message);
    }
    finally { setBusy(false); }
  }
  useEffect(() => { run(); }, [admin]);
  const current = admin ? selected : rows[0];
  const canSubmit = !admin && !['pendente','aprovada'].includes(current?.status);
  const cnpjError = showCnpjError && !isValidCnpj(cnpj) ? 'Confira o CNPJ e os dígitos verificadores.' : '';
  function decide(status) {
    Alert.alert('Confirmar decisão?', status === 'aprovada'
      ? 'Confirme que consultou a situação cadastral e verificou o vínculo da pessoa com o estabelecimento.'
      : 'A decisão e a justificativa ficarão registradas no histórico.', [
      {text:'Cancelar',style:'cancel'},
      {text:'Confirmar',onPress:() => run(async () => {
        await decideOwnerApproval(selected,status,reason);
        setSelected(null);
        setReason('');
      })},
    ]);
  }

  return <Formulario title={admin?'Validação de donos':'Sou dono de bar'} error={error}
    onVoltar={selected?()=>{setSelected(null);setReason('');setError('');}:onVoltar}>
    <Botao secondary disabled={busy} onPress={()=>run()}>{busy?'Carregando…':'Atualizar'}</Botao>
    {admin && !selected && <>
      <Botao secondary onPress={onCnpjsAdicionais}>Analisar CNPJs adicionais</Botao>
      <Campo label="Buscar por estabelecimento, CNPJ, UID ou situação" value={query} onChangeText={setQuery}/>
      <ListaPaginada items={rows.filter(row=>normalizeSearch([row.business,row.cnpj,row.uid,labels[row.status]].join(' ')).includes(normalizeSearch(query)))}
        resetKey={query} empty="Nenhuma solicitação encontrada." renderItem={row=><OpcaoConta key={row.uid} title={row.business}
          description={`${labels[row.status]} · CNPJ ${row.cnpj}`} onPress={()=>{setSelected(row);setReason('');setError('');}}/>}/>
    </>}
    {current && <>
      <Aviso>{current.business} · CNPJ {current.cnpj}\n{labels[current.status]}{admin?`\nSolicitante: ${current.uid}`:''}\n{current.reason}</Aviso>
      <ListaPaginada items={[...current.history].sort((a,b)=>b.version-a.version)} resetKey={current.uid} label="eventos"
        renderItem={event=><Aviso key={event.version}>{labels[event.status]} · {new Date(event.updated_at).toLocaleString('pt-BR')}\nResponsável: {event.updated_by}\n{event.reason}</Aviso>}/>
    </>}
    {admin && selected && <>
      <Botao secondary onPress={()=>Linking.openURL(receipt).catch(()=>setError('Não foi possível abrir a consulta da Receita Federal.'))}>Consultar CNPJ na Receita Federal</Botao>
      <Aviso>Confira a situação cadastral e o vínculo do solicitante antes de aprovar. Registre a justificativa sem incluir documentos ou dados pessoais.</Aviso>
      {['pendente','aprovada'].includes(selected.status) && <Campo label="Justificativa da decisão" value={reason} onChangeText={setReason} multiline maxLength={500} editable={!busy}/>}
      {selected.status==='pendente' && <>
        <Botao disabled={busy||reason.trim().length<5||!isValidCnpj(selected.cnpj)} onPress={()=>decide('aprovada')}>Aprovar cadastro de bares</Botao>
        <Botao secondary disabled={busy||reason.trim().length<5} onPress={()=>decide('recusada')}>Recusar solicitação</Botao>
      </>}
      {selected.status==='aprovada' && <Botao secondary disabled={busy||reason.trim().length<5} onPress={()=>decide('revogada')}>Revogar autorização de cadastro</Botao>}
    </>}
    {canSubmit && <>
      <Aviso>Informe o CNPJ e como pode comprovar seu vínculo. A administração combinará a conferência do comprovante. Evite incluir CPF ou dados pessoais na descrição.</Aviso>
      <Campo label="Nome do estabelecimento" value={business} onChangeText={setBusiness} maxLength={150} editable={!busy}/>
      <Campo label="CNPJ" value={cnpj} onChangeText={setCnpj} maxLength={18} autoCapitalize="characters" autoCorrect={false} error={cnpjError} editable={!busy}/>
      <Campo label="Como você comprova seu vínculo?" value={reason} onChangeText={setReason} multiline maxLength={500} editable={!busy}/>
      <Botao disabled={busy} onPress={()=>{
        setShowCnpjError(true);
        if (!isValidCnpj(cnpj)) {setError('Informe um CNPJ válido para enviar a solicitação.');return;}
        run(async ()=>{await submitOwnerApproval({cnpj,business,reason});setReason('');setShowCnpjError(false);});
      }}>Enviar para análise</Botao>
    </>}
  </Formulario>;
}
