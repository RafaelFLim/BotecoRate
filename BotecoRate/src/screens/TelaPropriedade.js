import {useEffect,useRef,useState} from 'react';
import {Alert,Text} from 'react-native';
import {usePreventRemove} from '@react-navigation/native';
import {Formulario,Botao,Campo,Aviso,OpcaoConta} from '../components/Formulario';
import HistoricoAdministrativo from '../components/HistoricoAdministrativo';
import {loadOwnership,lookupOwnershipAccount,inviteOwnership,answerOwnership} from '../services/ownershipService';

export default function TelaPropriedade({onVoltar,onAtualizarCatalogo}) {
  const [data,setData]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [bar,setBar]=useState(null),[request,setRequest]=useState(null),[kind,setKind]=useState('adicionar');
  const [recipient,setRecipient]=useState(''),[replace,setReplace]=useState(null),[reason,setReason]=useState(''),[search,setSearch]=useState('');
  const alive=useRef(true);
  usePreventRemove(Boolean(bar||request||busy),()=>back());
  useEffect(()=>{alive.current=true;load();return()=>{alive.current=false;};},[]);
  async function load() {
    setBusy(true);setError('');try{const next=await loadOwnership();if(alive.current){setData(next);setRequest(old=>old?next.requests.find(r=>r.id===old.id&&r.bar_id===old.bar_id)||null:null);}}
    catch(e){if(alive.current)setError(e.message);}finally{if(alive.current)setBusy(false);}
  }
  const name=uid=>data?.cards.find(c=>c.uid===uid)?.name||uid;
  async function run(work) {
    setBusy(true);setError('');
    try{await work();await onAtualizarCatalogo();if(alive.current){setBar(null);setRecipient('');setReason('');setReplace(null);await load();}}
    catch(e){if(alive.current){setError(`Não foi possível confirmar: ${e.message}. Atualize a tela para conferir o estado atual.`);setBusy(false);}}
  }
  async function send() {
    setBusy(true);setError('');
    try {
      const card=await lookupOwnershipAccount(recipient.trim());
      if(!alive.current)return;
      setBusy(false);
      Alert.alert('Confirmar convite',`${kind==='substituir'?`Substituir ${name(replace)} por`:'Adicionar como coproprietário:'} ${card.name}?\nTodos os donos atuais e a pessoa convidada precisarão aceitar.`,[
        {text:'Cancelar',style:'cancel'},{text:'Enviar convite',onPress:()=>run(()=>inviteOwnership({barId:bar.id,recipient:recipient.trim(),replaceUid:kind==='substituir'?replace:null,reason}))},
      ]);
    }catch(e){if(alive.current){setError(e.message);setBusy(false);}}
  }
  function respond(action,label) {
    Alert.alert(label,`Bar: ${request.bar_name}\n${request.kind==='substituir'?`Sai: ${name(request.replace_uid)}\nEntra: ${name(request.recipient_uid)}`:`Novo coproprietário: ${name(request.recipient_uid)}`}\nMotivo: ${request.reason}`,[
      {text:'Voltar',style:'cancel'},{text:'Confirmar',onPress:()=>run(()=>answerOwnership(request.bar_id,request.id,action))},
    ]);
  }
  function back(){
    if(busy){Alert.alert('Aguarde','A confirmação está em andamento.');return;}
    if(bar){
      if(recipient.trim()||reason.trim()||replace)Alert.alert('Descartar convite?', 'Os dados ainda não enviados serão descartados.', [{text:'Continuar preenchendo',style:'cancel'},{text:'Descartar',style:'destructive',onPress:()=>{setBar(null);setRecipient('');setReason('');setReplace(null);}}]);
      else setBar(null);
    }else if(request)setRequest(null);else onVoltar();
  }
  const pending=request?.status==='pendente',canAnswer=pending&&!request.stale&&!request.bar_deleted&&!request.participants?.[data?.actor];
  return <Formulario title="Propriedade e convites" onVoltar={back}>
    <Botao secondary disabled={busy} onPress={load}>{busy?'Conferindo…':'Atualizar'}</Botao>
    {!!error&&<Aviso>{error}</Aviso>}
    {data&&!data.online&&<Aviso>Consulta da última sincronização. Conecte-se para enviar convites ou responder.</Aviso>}
    {bar?<>
      <Text style={{fontSize:22,fontWeight:'700'}}>{bar.nome}</Text>
      <Aviso>O convite só muda os donos depois do aceite de todos os envolvidos. Convide pelo código da conta (UID), disponível em Minha conta.</Aviso>
      <Botao disabled={busy} secondary={kind!=='adicionar'} onPress={()=>setKind('adicionar')}>Adicionar coproprietário</Botao>
      <Botao disabled={busy} secondary={kind!=='substituir'} onPress={()=>setKind('substituir')}>Substituir um proprietário</Botao>
      {kind==='substituir'&&<><Aviso>Escolha quem será substituído. Essa pessoa também precisará aceitar.</Aviso>{bar.owners.map(uid=><Botao key={uid} disabled={busy} secondary={replace!==uid} onPress={()=>setReplace(uid)}>{name(uid)}{replace===uid?' · selecionado':''}</Botao>)}</>}
      <Campo label="Código de convite (UID) de quem entra" value={recipient} onChangeText={setRecipient} editable={!busy} autoCorrect={false}/>
      <Campo label="Motivo da inclusão ou transferência" value={reason} onChangeText={setReason} editable={!busy} multiline maxLength={500}/>
      <Botao disabled={busy||!data.online||!recipient.trim()||reason.trim().length<5||kind==='substituir'&&!replace} onPress={send}>Conferir e enviar convite</Botao>
    </>:request?<>
      <Text style={{fontSize:22,fontWeight:'700'}}>{request.bar_name}</Text>
      <Aviso>{request.kind==='substituir'?`Substituir ${name(request.replace_uid)} por ${name(request.recipient_uid)}`:`Adicionar ${name(request.recipient_uid)} como coproprietário`}\nSituação: {request.stale?'invalidada por mudança de propriedade ou acesso':request.status}\nMotivo: {request.reason}</Aviso>
      {request.required_order.split('|').filter(Boolean).map(uid=><Text key={uid} style={{marginVertical:6}}>{name(uid)}{uid===request.recipient_uid?' (convidado)':''}{uid===request.replace_uid?' (será substituído)':''}: {request.participants?.[uid]||'aguardando aceite'}</Text>)}
      {request.stale&&<Aviso>Os termos anteriores perderam a validade. É necessário enviar uma nova solicitação.</Aviso>}
      {pending&&<>
        <Botao disabled={busy||!data.online||!canAnswer} onPress={()=>respond('aceitar','Aceitar os termos?')}>Aceitar</Botao>
        <Botao secondary disabled={busy||!data.online||!canAnswer} onPress={()=>respond('recusar','Recusar os termos?')}>Recusar</Botao>
        {!request.stale&&request.participants?.[data.actor]==='aceito'&&request.participants?.[request.next_uid]==='aceito'&&<Botao disabled={busy||!data.online} onPress={()=>run(()=>answerOwnership(request.bar_id,request.id,'processar'))}>Concluir aceites registrados</Botao>}
        {data.actor===request.created_by&&<Botao secondary disabled={busy||!data.online} onPress={()=>respond('cancelar','Cancelar solicitação?')}>Cancelar solicitação</Botao>}
        {request.stale&&<Botao secondary disabled={busy||!data.online} onPress={()=>run(()=>answerOwnership(request.bar_id,request.id,'invalidar'))}>Registrar invalidação</Botao>}
      </>}
      <Aviso>Histórico desta solicitação</Aviso>
      <HistoricoAdministrativo events={data.events.filter(e=>e.entity_id===request.id&&e.record.bar_id===request.bar_id)} users={data.cards}/>
    </>:data&&<>
      <Aviso>Seu código de convite (toque e segure para copiar):</Aviso><Text selectable>{data.actor}</Text>
      <Aviso>Seus bares</Aviso>
      {data.bars.map(b=><OpcaoConta key={b.id} title={b.nome} description={`Donos: ${b.owners.map(name).join(', ')}. Enviar convite ou substituir proprietário.`} onPress={()=>{if(!busy){setBar(b);setKind('adicionar');setReplace(null);}}}/>)}
      {!data.bars.length&&<Aviso>Você ainda não é dono de um bar. Os convites recebidos aparecem abaixo.</Aviso>}
      <Campo label="Buscar convites por bar, pessoa ou situação" value={search} onChangeText={setSearch}/>
      {[...data.requests].sort((a,b)=>b.updated_at.localeCompare(a.updated_at)).filter(r=>[r.bar_name,r.status,r.stale?'invalidada':'',...r.required_order.split('|').filter(Boolean).map(name)].join(' ').toLowerCase().includes(search.toLowerCase())).map(r=><OpcaoConta key={`${r.bar_id}:${r.id}`} title={r.bar_name} description={`${r.kind==='substituir'?`Substituir ${name(r.replace_uid)} por`:'Convidar'} ${name(r.recipient_uid)} · ${r.stale?'invalidada':r.status}`} onPress={()=>{if(!busy)setRequest(r);}}/>)}
      {!data.requests.length&&<Aviso>Nenhum convite enviado ou recebido.</Aviso>}
      <Aviso>Histórico de propriedade</Aviso><HistoricoAdministrativo events={data.events} users={data.cards}/>
    </>}
  </Formulario>;
}
