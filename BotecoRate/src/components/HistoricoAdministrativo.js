import { useState } from 'react';
import { Text, View } from 'react-native';
import { Campo, Aviso, Botao, MensagemErro } from './Formulario';
import { describeHistoryPhoto } from '../utils/historyPhoto';
import { matchesHistoryContext, normalizeSearch, normalizedCep, orderHistory } from '../utils/historyFilters';
import ListaPaginada from './ListaPaginada';

const labels={perfil:'Nome de usuário',propriedade:'Propriedade',create:'Cadastro',update:'Alteração',soft_delete:'Envio à lixeira',moderacao:'Moderação',acesso:'Acesso do usuário'};
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
export default function HistoricoAdministrativo({events=[],users=[],contextFilters=false}) {
  const [query,setQuery]=useState('');
  const [filters,setFilters]=useState({bar:'',owner:'',address:'',cep:'',withoutCep:false});
  const [expanded,setExpanded]=useState(false);
  const updateFilter=(field,value)=>setFilters(previous=>({...previous,[field]:value}));
  const name=uid=>users.find(u=>u.uid===uid)?.name||uid||'Legado/sistema';
  const field=(key,value)=>['recipient_uid','replace_uid'].includes(key)&&value?name(value):key==='kind'&&value?({adicionar:'Adicionar coproprietário',substituir:'Substituir proprietário'}[value]||value):describe(value);
  const ordered=orderHistory(events);
  const filtered=ordered.filter(e=>(!contextFilters||matchesHistoryContext(e,filters,users))&&normalizeSearch([eventTitle(e),e.entity_type,tableLabels[e.entity_type],e.entity_id,e.display_name,e.operation,labels[e.operation],e.record?.updated_at,e.record?.reason,name(e.actor_uid),e.actor_uid,e.vote,e.record?.recipient_uid,e.record?.replace_uid,e.record?.nome,e.record?.comentario,describeHistoryPhoto(e.before?.absent?null:e.before?.foto,e.record?.foto)].join(' ')).includes(normalizeSearch(query)));
  return <>
    <Campo label="Buscar no histórico: registro, responsável, data (AAAA-MM-DD) ou motivo" value={query} onChangeText={setQuery}/>
    {contextFilters&&<>
      <Botao secondary onPress={()=>setExpanded(value=>!value)}>{expanded?'Recolher filtros':'Filtros por bar, dono e endereço'}</Botao>
      {expanded&&<>
        <Campo label="Bar: parte do nome ou ID exato" value={filters.bar} onChangeText={value=>updateFilter('bar',value)}/>
        <Campo label="Dono atual ou anterior: parte do nome ou UID exato" value={filters.owner} onChangeText={value=>updateFilter('owner',value)}/>
        <Campo label="Endereço atual ou anterior: rua, bairro ou cidade" value={filters.address} onChangeText={value=>updateFilter('address',value)}/>
        <Campo label="CEP exato" value={filters.cep} onChangeText={value=>setFilters(previous=>({...previous,cep:value,withoutCep:false}))} keyboardType="number-pad" maxLength={9}/>
        {!!filters.cep&&!normalizedCep(filters.cep)&&<MensagemErro>Informe oito números no CEP, com ou sem hífen.</MensagemErro>}
        <Botao secondary onPress={()=>setFilters(previous=>({...previous,cep:'',withoutCep:!previous.withoutCep}))}>{filters.withoutCep?'Mostrar todos os CEPs':'Somente bares sem CEP registrado'}</Botao>
        <Aviso>Filtros combinados consideram os dados atuais e os anteriores registrados do bar. Dono é o vínculo de propriedade, não quem fez a alteração. Convites pendentes não contam como propriedade. CEP não é deduzido pelo endereço.</Aviso>
      </>}
      {(query||Object.values(filters).some(Boolean))&&<Botao secondary onPress={()=>{setQuery('');setFilters({bar:'',owner:'',address:'',cep:'',withoutCep:false});}}>Limpar consulta e filtros</Botao>}
    </>}
    <ListaPaginada items={filtered} resetKey={JSON.stringify([query,contextFilters,filters])} label="eventos" empty="Nenhum evento encontrado." renderItem={(h,index)=>{
      const before=h.before?.absent?{}:h.before||{},after=h.record||{};
      const fields=Object.keys(fieldLabels).filter(k=>k==='foto'
        ? Boolean(describeHistoryPhoto(before[k],after[k]))
        : before[k]!==after[k]&&(before[k]!=null||after[k]!=null));
      return <View key={`${h.entity_type}:${h.bar_id||''}:${h.entity_id}:${after.version}:${index}`} style={{padding:14,backgroundColor:'white',borderRadius:10,marginBottom:10}}>
        <Text style={{fontWeight:'700'}}>{eventTitle(h)} · {tableLabels[h.entity_type]||h.entity_type} · {h.display_name||h.entity_id}</Text>
        <Text>{after.updated_at?new Date(after.updated_at).toLocaleString('pt-BR'):'Data indisponível'} · versão {after.version}</Text>
        <Text>Registro: {h.entity_id}</Text><Text>Responsável: {name(h.actor_uid)}</Text>
        {h.bar_context&&<Text>Bar: {h.bar_context.names[0]||h.bar_context.id} · {h.bar_context.id}</Text>}
        {h.bar_context&&<Text>CEPs registrados: {h.bar_context.ceps.length?h.bar_context.ceps.map(value=>`${value.slice(0,5)}-${value.slice(5)}`).join(', '):'não informado'}</Text>}
        {fields.map(k=>k==='foto'
          ? <Text key={k}>{describeHistoryPhoto(before[k],after[k])}</Text>
          : <Text key={k}>{fieldLabels[k]}: {field(k,before[k])} → {field(k,after[k])}</Text>)}
        {h.vote && h.vote!=='nenhum'&&<Text>Resposta registrada: {h.vote}</Text>}
        {!!after.reason&&<Text style={{marginTop:8}}>Justificativa: {after.reason}</Text>}
        {!fields.length&&!after.reason&&<Text>Evento sem alteração nos campos de exibição.</Text>}
      </View>;
    }}/>
  </>;
}
