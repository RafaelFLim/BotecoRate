import { useState } from 'react';
import { Text, View } from 'react-native';
import { Campo, Aviso } from './Formulario';

const labels={propriedade:'Propriedade',create:'Cadastro',update:'Alteração',soft_delete:'Envio à lixeira',moderacao:'Moderação',acesso:'Acesso do usuário'};
const tableLabels={propriedade:'Propriedade do bar',usuarios:'Usuários',bares:'Bares',itens_cardapio:'Itens do cardápio',avaliacoes_bares:'Avaliações de bares',avaliacoes_itens:'Avaliações de itens'};
const fieldLabels={kind:'Operação',recipient_uid:'Quem entra',replace_uid:'Quem será substituído',accepted_count:'Aceites registrados',nome:'Nome',name:'Nome',endereco:'Endereço',detalhes:'Detalhes',descricao:'Descrição',foto:'Foto',latitude:'Latitude',longitude:'Longitude',tipo:'Tipo',criado_por:'Cadastrado por',autor_nome:'Autor',elegivel_ranking:'Conta para o ranking',nota:'Nota',comentario:'Comentário',valor_centavos:'Preço em centavos',role:'Permissão',status:'Estado',deleted_at:'Excluído em'};
function eventTitle(h) {
  if(h.operation!=='propriedade')return labels[h.operation]||h.operation;
  if(h.before?.absent)return 'Convite enviado';
  if(h.record?.status==='concluida')return 'Propriedade atualizada';
  if(h.record?.status==='cancelada')return 'Convite cancelado';
  if(h.record?.status==='invalidada')return 'Convite invalidado';
  if(h.vote==='aceito')return 'Aceite registrado';
  if(h.vote==='recusado')return 'Convite recusado';
  return 'Aceites conferidos';
}
const describe=(value)=>value===null||value===undefined?'Não definido':String(value);
export default function HistoricoAdministrativo({events=[],users=[]}) {
  const [query,setQuery]=useState('');
  const name=uid=>users.find(u=>u.uid===uid)?.name||uid||'Legado/sistema';
  const field=(key,value)=>['recipient_uid','replace_uid'].includes(key)&&value?name(value):key==='kind'&&value?({adicionar:'Adicionar coproprietário',substituir:'Substituir proprietário'}[value]||value):describe(value);
  const ordered=[...events].sort((a,b)=>String(b.record?.updated_at||'').localeCompare(String(a.record?.updated_at||'')));
  const filtered=ordered.filter(e=>[eventTitle(e),e.entity_type,tableLabels[e.entity_type],e.entity_id,e.display_name,e.operation,labels[e.operation],e.record?.updated_at,e.record?.reason,name(e.actor_uid),e.actor_uid,e.vote,e.record?.recipient_uid,e.record?.replace_uid,e.record?.nome,e.record?.comentario].join(' ').toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <>
    <Campo label="Buscar no histórico: registro, responsável, data (AAAA-MM-DD) ou motivo" value={query} onChangeText={setQuery}/>
    {!filtered.length&&<Aviso>Nenhum evento encontrado.</Aviso>}
    {filtered.map((h,index)=>{
      const before=h.before?.absent?{}:h.before||{},after=h.record||{};
      const fields=Object.keys(fieldLabels).filter(k=>before[k]!==after[k]&&(before[k]!=null||after[k]!=null));
      return <View key={`${h.entity_type}:${h.entity_id}:${after.version}:${index}`} style={{padding:14,backgroundColor:'white',borderRadius:10,marginBottom:10}}>
        <Text style={{fontWeight:'700'}}>{eventTitle(h)} · {tableLabels[h.entity_type]||h.entity_type} · {h.display_name||h.entity_id}</Text>
        <Text>{after.updated_at?new Date(after.updated_at).toLocaleString('pt-BR'):'Data indisponível'} · versão {after.version}</Text>
        <Text>Registro: {h.entity_id}</Text><Text>Responsável: {name(h.actor_uid)}</Text>
        {fields.map(k=><Text key={k}>{fieldLabels[k]}: {field(k,before[k])} → {field(k,after[k])}</Text>)}
        {h.vote && h.vote!=='nenhum'&&<Text>Resposta registrada: {h.vote}</Text>}
        {!!after.reason&&<Text style={{marginTop:8}}>Justificativa: {after.reason}</Text>}
        {!fields.length&&!after.reason&&<Text>Evento sem alteração nos campos de exibição.</Text>}
      </View>;
    })}
  </>;
}
