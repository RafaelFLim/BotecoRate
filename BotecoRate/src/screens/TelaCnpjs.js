import { useEffect, useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import { Aviso, Botao, Campo, Formulario, OpcaoConta } from '../components/Formulario';
import ListaPaginada from '../components/ListaPaginada';
import { availableCnpjs } from '../services/cnpjProtocol';
import { decideAdditionalCnpjs, loadAdditionalCnpjs, loadCnpjOptions, submitAdditionalCnpjs } from '../services/ownerApprovalService';
import { normalizeSearch } from '../utils/historyFilters';

const statusLabel={pendente:'Em análise',aprovada:'Aprovado',recusada:'Recusado'};

export function CadastroComCnpj({ onVoltar, pendingCnpjs, children }) {
  const [data,setData]=useState(null);
  const [options,setOptions]=useState([]);
  const [fields,setFields]=useState(['']);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(true);
  async function load(action) {
    setBusy(true);setError('');
    try {
      await action?.();
      const result=await loadCnpjOptions({allowOffline:true});
      setData(result);
      setOptions(availableCnpjs(result.initial,result.extras,result.usage,pendingCnpjs));
    } catch(e) {setError(e.message);}
    finally {setBusy(false);}
  }
  useEffect(()=>{load();},[]);
  if (options.length) return children(options);
  return <Formulario title="CNPJ para novo bar" error={error} onVoltar={onVoltar}>
    <Botao secondary disabled={busy} onPress={()=>load()}>{busy?'Carregando…':'Atualizar CNPJs'}</Botao>
    {data && <>
      <Aviso>Você não tem CNPJs disponíveis para um novo bar. Envie um ou mais CNPJs para a administração analisar.</Aviso>
      {!!notice&&<Aviso>{notice}</Aviso>}
      {fields.map((value,index)=><View key={index} style={{flexDirection:'row',alignItems:'center',gap:8}}>
        <View style={{flex:1}}><Campo label={`CNPJ ${index+1}`} value={value} autoCapitalize="characters" autoCorrect={false} maxLength={18}
          onChangeText={value=>{setFields(previous=>previous.map((old,i)=>i===index?value:old));setError('');}} editable={!busy}/></View>
        {index===fields.length-1 && fields.length<20 && <Botao secondary disabled={busy} onPress={()=>setFields(previous=>[...previous,''])}>+ CNPJ</Botao>}
        {fields.length>1 && <Botao secondary disabled={busy} onPress={()=>setFields(previous=>previous.filter((_,i)=>i!==index))}>Remover</Botao>}
      </View>)}
      <Botao disabled={busy} onPress={()=>load(async()=>{
        await submitAdditionalCnpjs(fields);
        setFields(['']);setNotice('Solicitação enviada. Você poderá acompanhar a decisão aqui.');
      })}>Enviar CNPJs para análise</Botao>
      <ListaPaginada items={Object.entries(data.extras)} label="CNPJs" empty="Nenhum CNPJ adicional solicitado."
        renderItem={([cnpj,row])=><Aviso key={cnpj}>{cnpj} · {data.usage[cnpj]?'Vinculado a um bar':statusLabel[row.status]}{row.status==='recusada'?` · ${row.reason}`:''}</Aviso>}/>
    </>}
  </Formulario>;
}

export function AnaliseCnpjs({ onVoltar }) {
  const [groups,setGroups]=useState([]);
  const [uid,setUid]=useState(null);
  const [selected,setSelected]=useState([]);
  const [query,setQuery]=useState('');
  const [reason,setReason]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(true);
  async function load(action) {
    setBusy(true);setError('');
    try {
      await action?.();
      setGroups(await loadAdditionalCnpjs());
      setSelected([]);
    } catch(e) {setError(e.message);}
    finally {setBusy(false);}
  }
  useEffect(()=>{load();},[]);
  const group=groups.find(item=>item.uid===uid);
  const pending=group?.rows.filter(row=>row.status==='pendente')||[];
  function decide(status) {
    const rows=pending.filter(row=>selected.includes(row.cnpj));
    const label=status==='aprovada'?'Aprovar':'Recusar';
    Alert.alert(`${label} ${rows.length} CNPJ(s)?`,status==='aprovada'?'Confirme a situação cadastral e a comprovação do vínculo de cada estabelecimento.':reason,[
      {text:'Cancelar',style:'cancel'},
      {text:label,onPress:()=>load(async()=>{await decideAdditionalCnpjs(uid,rows,status,reason);setReason('');})},
    ]);
  }
  return <Formulario title="CNPJs adicionais" error={error} onVoltar={group?()=>{setUid(null);setSelected([]);setReason('');setError('');}:onVoltar}>
    <Botao secondary disabled={busy} onPress={()=>load()}>{busy?'Carregando…':'Atualizar pedidos'}</Botao>
    {group?<>
      <Aviso>{group.name} · {pending.length} pendente(s)</Aviso>
      <Botao secondary disabled={busy||!pending.length} onPress={()=>setSelected(pending.map(row=>row.cnpj))}>Selecionar todos os pendentes deste usuário</Botao>
      {!!selected.length&&<Botao secondary disabled={busy} onPress={()=>setSelected([])}>Limpar seleção</Botao>}
      <ListaPaginada items={group.rows} resetKey={uid} label="CNPJs" renderItem={row=>row.status==='pendente'
        ? <Botao key={row.cnpj} disabled={busy} secondary={!selected.includes(row.cnpj)}
          onPress={()=>setSelected(previous=>previous.includes(row.cnpj)?previous.filter(cnpj=>cnpj!==row.cnpj):[...previous,row.cnpj])}>
          {row.cnpj}{selected.includes(row.cnpj)?' · Selecionado':' · Em análise'}
        </Botao>
        : <Aviso key={row.cnpj}>{row.cnpj} · {statusLabel[row.status]} · {row.reason}</Aviso>}/>
      <Botao secondary onPress={()=>Linking.openURL('https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/Cnpjreva_S.aspx').catch(()=>setError('Não foi possível abrir a Receita Federal.'))}>Consultar CNPJ na Receita Federal</Botao>
      <Campo label="Justificativa da decisão" value={reason} onChangeText={setReason} editable={!busy} multiline maxLength={500}/>
      <Botao disabled={busy||!selected.length||reason.trim().length<5} onPress={()=>decide('aprovada')}>Aprovar selecionados ({selected.length})</Botao>
      <Botao secondary disabled={busy||!selected.length||reason.trim().length<5} onPress={()=>decide('recusada')}>Recusar selecionados ({selected.length})</Botao>
      <Aviso>Histórico de solicitações e decisões</Aviso>
      <ListaPaginada items={group.rows.flatMap(row=>row.history.map(event=>({cnpj:row.cnpj,...event})))
        .sort((a,b)=>b.updated_at.localeCompare(a.updated_at))} resetKey={uid} label="eventos"
        renderItem={event=><Aviso key={`${event.cnpj}:${event.version}`}>{event.cnpj} · {statusLabel[event.status]}{'\n'}
          {new Date(event.updated_at).toLocaleString('pt-BR')} · {event.updated_by}{'\n'}{event.reason}</Aviso>}/>
    </>:<>
      <Campo label="Buscar usuário, UID ou CNPJ" value={query} onChangeText={setQuery}/>
      <ListaPaginada items={groups.filter(group=>normalizeSearch([group.name,group.uid,...group.rows.map(row=>row.cnpj)].join(' ')).includes(normalizeSearch(query)))}
        resetKey={query} label="usuários" renderItem={group=><OpcaoConta key={group.uid} title={group.name}
          description={`${group.rows.filter(row=>row.status==='pendente').length} CNPJ(s) em análise`} onPress={()=>setUid(group.uid)}/>}/>
    </>}
  </Formulario>;
}
