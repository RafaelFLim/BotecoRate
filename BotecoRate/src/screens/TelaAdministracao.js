import { useEffect, useRef, useState } from 'react';
import { Alert, Text } from 'react-native';
import { Formulario, Campo, Botao, Aviso, OpcaoConta } from '../components/Formulario';
import HistoricoAdministrativo from '../components/HistoricoAdministrativo';
import { loadAdministration, changeUserAccess, moderateReview } from '../services/adminService';

export default function TelaAdministracao({onVoltar,onAtualizarCatalogo}) {
  const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [tab,setTab]=useState('usuarios'),[search,setSearch]=useState(''),[selected,setSelected]=useState(null),[reason,setReason]=useState('');
  const alive=useRef(true);
  useEffect(()=>{alive.current=true;load();return()=>{alive.current=false;};},[]);
  async function load() {
    setBusy(true);setError('');
    try {const next=await loadAdministration();if(alive.current){setData(next);setSelected(null);setReason('');}}
    catch(e){if(alive.current){setError(e.message);setData(null);}}
    finally {if(alive.current)setBusy(false);}
  }
  async function execute(action) {
    setBusy(true);setError('');
    try {
      if(tab==='usuarios') await changeUserAccess(selected.uid,action,reason);
      else await moderateReview(selected.table,selected.id,action,reason);
      await onAtualizarCatalogo();
      await load();
    } catch(e){if(alive.current){setError(`Não foi possível confirmar a ação: ${e.message}. Atualize o painel antes de tentar novamente.`);setBusy(false);}}
  }
  function confirm(action,label) {
    if(busy)return;
    Alert.alert(label,`Justificativa: ${reason.trim()}\nConfirme a alteração para ${selected.name||selected.autor_nome||selected.id}.`,[
      {text:'Cancelar',style:'cancel'},{text:'Confirmar',style:'destructive',onPress:()=>execute(action)},
    ]);
  }
  const disabled=busy||reason.trim().length<5||reason.trim().length>500;
  const filtered=(tab==='usuarios'?data?.users:data?.reviews)?.filter(row=>[row.name,row.email,row.uid,row.comentario,row.target,row.autor_nome].some(v=>String(v||'').toLocaleLowerCase().includes(search.toLocaleLowerCase())));
  return <Formulario title="Administração" onVoltar={selected?()=>{setSelected(null);setReason('');}:onVoltar}>
    <Aviso>Alterações exigem internet e justificativa. Toda ação fica registrada com responsável, data e valores anteriores.</Aviso>
    <Botao disabled={busy} secondary onPress={load}>{busy?'Carregando…':'Atualizar painel'}</Botao>
    {!!error&&<Aviso>{error}</Aviso>}
    {!selected?<>
      <Botao secondary={tab!=='usuarios'} disabled={busy} onPress={()=>setTab('usuarios')}>Usuários</Botao>
      <Botao secondary={tab!=='avaliacoes'} disabled={busy} onPress={()=>setTab('avaliacoes')}>Avaliações</Botao>
      <Botao secondary={tab!=='historico'} disabled={busy} onPress={()=>setTab('historico')}>Histórico geral</Botao>
      {tab==='historico'?<HistoricoAdministrativo events={data?.events||[]} users={data?.users||[]}/>:<>
      <Campo label="Buscar" value={search} onChangeText={setSearch}/>
      {filtered?.map(row=><OpcaoConta key={row.uid||`${row.table}:${row.id}`} title={row.name||`${row.target||'Avaliação'} · ${row.nota}/5`}
        description={row.uid?`${row.email}\n${row.access.role} · ${row.access.status}`:`${row.autor_nome}: ${row.comentario}\n${row.moderation?.status||'visivel'}`}
        onPress={()=>{if(!busy){setSelected(row);setReason('');setError('');}}}/>)}
      {data&&!filtered?.length&&<Aviso>Nenhum registro encontrado. Contas antigas entram no diretório ao fazer login novamente ou pela importação administrativa.</Aviso>}
      </>}
    </>:<>
      <Text style={{fontWeight:'700',fontSize:20}}>{selected.name||selected.target||'Avaliação'}</Text>
      <Aviso>{tab==='usuarios'?`${selected.email}\nUID: ${selected.uid}\n${selected.access.role} · ${selected.access.status}`:`${selected.autor_nome} · ${selected.nota}/5\n${selected.comentario}\nEstado: ${selected.moderation?.status||'visivel'}`}</Aviso>
      {(selected.access?.deleted_at||selected.moderation?.deleted_at)&&<Aviso>Na lixeira. Prazo de restauração: {new Date(selected.access?.purge_after||selected.moderation?.purge_after).toLocaleString('pt-BR')}.</Aviso>}
      <Campo label="Justificativa obrigatória" value={reason} onChangeText={setReason} multiline maxLength={500} editable={!busy}/>
      {tab==='usuarios'?selected.uid===data.actor?<Aviso>Seu próprio acesso está protegido contra alterações neste painel.</Aviso>:<>
        {selected.access.status==='ativo'&&['comum','dono','admin'].map(role=><Botao key={role} disabled={disabled||selected.access.role===role||role!=='comum'&&!selected.email_verified} onPress={()=>confirm(role,`Alterar permissão para ${role}?`)}>Permissão: {role}</Botao>)}
        {selected.access.status==='ativo'&&<Botao disabled={disabled} onPress={()=>confirm('banir','Banir usuário?')}>Banir usuário</Botao>}
        {['banido','excluido'].includes(selected.access.status)&&<Botao disabled={disabled} onPress={()=>confirm('restaurar','Restaurar acesso?')}>Restaurar acesso</Botao>}
        {selected.access.status!=='excluido'&&<Botao secondary disabled={disabled} onPress={()=>confirm('excluir','Mover usuário para a lixeira por 30 dias?')}>Mover usuário para a lixeira</Botao>}
      </>:<>
        <Botao disabled={disabled||['oculta','excluida'].includes(selected.moderation?.status)} onPress={()=>confirm('oculta','Ocultar avaliação?')}>Ocultar avaliação</Botao>
        <Botao disabled={disabled||!['oculta','excluida'].includes(selected.moderation?.status)} onPress={()=>confirm('visivel','Restaurar avaliação?')}>Restaurar avaliação</Botao>
        <Botao secondary disabled={disabled||selected.moderation?.status==='excluida'} onPress={()=>confirm('excluida','Mover avaliação para a lixeira por 30 dias?')}>Mover avaliação para a lixeira</Botao>
      </>}
      <Aviso>Histórico deste registro</Aviso>
      <HistoricoAdministrativo users={data.users} events={data.events.filter(e=>e.entity_id===(selected.uid||selected.id) && e.entity_type===(tab==='usuarios'?'usuarios':selected.table))}/>

    </>}
  </Formulario>;
}
