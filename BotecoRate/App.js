import { useEffect, useState } from 'react';
import { Alert, AppState, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import MensagemErro from './src/components/MensagemErro';
import NetInfo from '@react-native-community/netinfo';
import { randomUUID } from 'expo-crypto';
import TelaLogin from './src/screens/TelaLogin';
import TelaAcessoConta from './src/screens/TelaAcessoConta';
import TelaCadastroUsuario from './src/screens/TelaCadastroUsuario';
import TelaBiometria from './src/screens/TelaBiometria';
import TelaListagemBares from './src/screens/TelaListagemBares';
import TelaMapaGPS from './src/screens/TelaMapaGPS';
import TelaPropriedade from './src/screens/TelaPropriedade';
import TelaAdministracao from './src/screens/TelaAdministracao';
import TelaPerfil from './src/screens/TelaPerfil';
import TelaAjusteConta, { TelaEscolhaVinculo } from './src/screens/TelaAjusteConta';
import TelaDetalhesBar from './src/screens/TelaDetalhesBar';
import TelaDetalhesItem from './src/screens/TelaDetalhesItem';
import TelaCadastroBar from './src/screens/TelaCadastroBar';
import TelaGerenciarBar from './src/screens/TelaGerenciarBar';
import TelaFormularioItem from './src/screens/TelaFormularioItem';
import TelaCamera from './src/screens/TelaCamera';
import TelaSincronizacao from './src/screens/TelaSincronizacao';
import TelaAbertura from './src/screens/TelaAbertura';
import { Formulario, Botao, Aviso } from './src/components/Formulario';
import { migrateLegacyData } from './src/database/legacyMigration';
import { carregarBares, alterarBares, subscribeCatalog, editarBar, excluirBar } from './src/services/storage';
import { subscribeSession, getActiveUser, logout, lockSession, watchAccess } from './src/services/authService';
import { syncCatalog } from './src/services/syncService';
import { persistPhoto } from './src/services/mediaService';
import { podeInteragir, podeAvaliar, podeCadastrarBar, podeGerenciarBar } from './src/utils/permissoes';

const Stack = createNativeStackNavigator();
const photoRequests = new Map();

function CameraRoute({ navigation, route }) {
  useEffect(() => () => { photoRequests.delete(route.params.requestId); }, [route.params.requestId]);
  return <TelaCamera onVoltar={() => navigation.goBack()} onFotoCapturada={async uri => {
      const photo = await persistPhoto(uri);
      photoRequests.get(route.params.requestId)?.(photo);
      navigation.goBack();
  }} />;
}

export default function App() {
  const [ready, setReady] = useState(false); const [startupError, setStartupError] = useState('');
  const [user, setUser] = useState(null); const [bares, setBares] = useState([]);
  const [statusSync, setStatusSync] = useState('Consulta local');
  const [actionError,setActionError]=useState(''),[syncError,setSyncError]=useState('');
  async function load() {
    const uid = getActiveUser()?.id;
    const catalog = await carregarBares();
    if (getActiveUser()?.id === uid) setBares(catalog);
  }
  async function start() {
    setStartupError('');
    try { await lockSession(); await migrateLegacyData(); await load(); setReady(true); }
    catch (error) { setStartupError(error.message); }
  }
  async function sync() {
    try { setStatusSync('Atualizando...'); setStatusSync(await syncCatalog()); await load();setSyncError(''); }
    catch (error) { setStatusSync('Não foi possível atualizar: ' + error.message);setSyncError('Não foi possível atualizar o catálogo. '+error.message); }
  }
  useEffect(() => {
    start();
    const stopUser = subscribeSession(next => { setBares([]); setUser(next);setActionError('');setSyncError(''); });
    const stopCatalog = subscribeCatalog(() => { load().catch(error=>setStartupError(error.message)); });
    return () => { stopUser(); stopCatalog(); };
  }, []);
  useEffect(() => {
    if (!ready) return;
    sync();
    const stopNetwork = NetInfo.addEventListener(state => { if (state.isConnected && state.isInternetReachable !== false) sync(); });
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') sync(); });
    const retry = setInterval(sync, 30000);
    return () => { stopNetwork(); foreground.remove(); clearInterval(retry); };
  }, [ready, user?.id, user?.emailVerificado, user?.papel]);
  useEffect(() => { if (ready) load().catch(e=>setStartupError(e.message)); }, [ready, user?.id, user?.papel]);
  useEffect(()=>watchAccess(()=>setActionError('Acesso encerrado: sua conta foi suspensa ou excluída pela administração.')), [user?.id]);
  async function changeBar(id, transform) {
    await alterarBares(list => list.map(bar => bar.id === id ? transform(bar) : bar));
    await load();
  }
  function itemChange(bar, itemId, transform) { return {...bar,cardapio:bar.cardapio.map(item=>item.id===itemId?transform(item):item)}; }
  function reviewsChange(target, id, data) { return {...target,avaliacoes:target.avaliacoes.map(r=>r.id===id?{...r,...data}:r)}; }
  async function safe(action) {
    setActionError('');
    try { await action(); sync(); return true; }
    catch(error) { setActionError('Não foi possível salvar. '+error.message); return false; }
  }
  const catalogActions = {
    onAvaliar: (id,r)=>safe(()=>changeBar(id,b=>({...b,avaliacoes:[{...r,id:randomUUID()},...b.avaliacoes]}))),
    onEditarAvaliacao: (id,r,data)=>safe(()=>changeBar(id,b=>reviewsChange(b,r,data))),
    onExcluirAvaliacao: (id,r)=>safe(()=>changeBar(id,b=>({...b,avaliacoes:b.avaliacoes.filter(v=>v.id!==r)}))),
    onExcluirItemCardapio: (id,i)=>safe(()=>changeBar(id,b=>({...b,cardapio:b.cardapio.filter(v=>v.id!==i)}))),
    onDefinirLocalizacao: (id,c)=>changeBar(id,b=>({...b,latitude:c.latitude,longitude:c.longitude})),
  };
  const reset = (navigation,name) => navigation.reset({index:0,routes:[{name}]});
  const openCamera = navigation => callback => {
    const requestId=randomUUID(); photoRequests.set(requestId,callback); navigation.navigate('Camera',{requestId});
  };
  const missing = navigation => <Formulario title="Conteúdo indisponível" error="Este conteúdo não está disponível para esta conta. Volte e atualize a lista para continuar." onVoltar={()=>navigation.goBack()}/>;
  if (!ready) return <SafeAreaProvider><TelaAbertura error={startupError} onRetry={start}/></SafeAreaProvider>;
  return <SafeAreaProvider><View style={{flex:1}}>
    {!!(actionError||syncError)&&<SafeAreaView edges={['top']} style={{paddingHorizontal:16,backgroundColor:'#fef2f2'}}><MensagemErro onDismiss={()=>{setActionError('');if(syncError)setStatusSync('Toque para tentar atualizar o catálogo');setSyncError('');}}>{actionError||syncError}</MensagemErro></SafeAreaView>}
    <NavigationContainer><Stack.Navigator initialRouteName="Lista" screenOptions={{headerShown:false,gestureEnabled:true}}>
    <Stack.Screen name="ContaLocal">{({navigation})=><TelaLogin accountType="local" onVoltar={()=>navigation.goBack()} onEntrar={()=>reset(navigation,'Lista')} onConsultar={()=>reset(navigation,'Lista')} onAbrirCadastro={()=>navigation.navigate('CadastroLocal')} onEntrarComBiometria={candidate=>navigation.navigate('Biometria',{accountId:candidate.id})}/>}</Stack.Screen>
    <Stack.Screen name="ContaEmail">{({navigation})=><TelaLogin accountType="email" onVoltar={()=>navigation.goBack()} onEntrar={()=>reset(navigation,'Lista')} onConsultar={()=>reset(navigation,'Lista')} onAbrirCadastro={()=>navigation.navigate('CadastroEmail')} onEntrarComBiometria={candidate=>navigation.navigate('Biometria',{accountId:candidate.id})}/>}</Stack.Screen>
    <Stack.Screen name="CadastroLocal">{({navigation})=><TelaCadastroUsuario accountType="local" onVoltar={()=>navigation.goBack()} onCadastrar={()=>reset(navigation,'Lista')}/>}</Stack.Screen>
    <Stack.Screen name="CadastroEmail">{({navigation})=><TelaCadastroUsuario accountType="email" onVoltar={()=>navigation.goBack()} onCadastrar={()=>reset(navigation,'Lista')}/>}</Stack.Screen>
    <Stack.Screen name="Biometria" options={{gestureEnabled:false}}>{({navigation,route})=><TelaBiometria accountId={route.params?.accountId} onVoltar={()=>navigation.goBack()} onEntrar={()=>reset(navigation,'Lista')}/>}</Stack.Screen>
    <Stack.Screen name="Lista">{({navigation})=><TelaListagemBares bares={bares} usuarioLogado={user} statusSync={statusSync} errorSync={Boolean(syncError)} onSincronizar={sync}
      onRevisarSincronizacao={()=>navigation.navigate('Sincronizacao')}
      onAbrirMapa={()=>navigation.navigate('Mapa')} onAbrirPerfil={()=>navigation.navigate('Perfil')}
      onAbrirCadastro={()=>navigation.navigate('CadastroBar')}
      onAbrirBar={id=>podeInteragir(user)?navigation.navigate('DetalhesBar',{barId:id}):Alert.alert('Somente consulta','Entre com uma conta e verifique seu e-mail para acessar cardápios e avaliações.')}/>}</Stack.Screen>
    <Stack.Screen name="Mapa">{({navigation})=><TelaMapaGPS onVoltar={()=>navigation.goBack()}/>}</Stack.Screen>
    <Stack.Screen name="Sincronizacao">{({navigation})=><TelaSincronizacao onVoltar={()=>navigation.goBack()} onSincronizar={sync}/>}</Stack.Screen>
    <Stack.Screen name="Propriedade">{({navigation})=>podeInteragir(user)?<TelaPropriedade key={user.id} onVoltar={()=>navigation.goBack()} onAtualizarCatalogo={sync}/>:missing(navigation)}</Stack.Screen>
    <Stack.Screen name="Administracao">{({navigation})=>user?.papel==='admin' && podeInteragir(user)?<TelaAdministracao key={user.id} onVoltar={()=>navigation.goBack()} onAtualizarCatalogo={sync}/>:missing(navigation)}</Stack.Screen>
    <Stack.Screen name="Perfil">{({navigation})=>user ? <TelaPerfil onPropriedade={()=>navigation.navigate('Propriedade')} onAdministracao={()=>navigation.navigate('Administracao')} usuarioLogado={user} onVoltar={()=>navigation.goBack()} onAbrirOpcao={secao=>navigation.navigate('AjusteConta',{secao})} onVincular={()=>navigation.navigate('EscolhaVinculo')}/> : <TelaAcessoConta onVoltar={()=>navigation.goBack()} onContaLocal={()=>navigation.navigate('ContaLocal')} onContaEmail={()=>navigation.navigate('ContaEmail')}/>}</Stack.Screen>
    <Stack.Screen name="EscolhaVinculo">{({navigation})=>user?.origem === 'local' ? <TelaEscolhaVinculo onVoltar={()=>navigation.goBack()} onEscolher={existing=>navigation.navigate('AjusteConta',{secao:'vinculo',existing})}/> : <Formulario title="Conta com e-mail" onVoltar={()=>navigation.goBack()}><Aviso>Sua conta já usa e-mail.</Aviso><Botao onPress={()=>navigation.popTo('Perfil')}>Voltar à minha conta</Botao></Formulario>}</Stack.Screen>
    <Stack.Screen name="AjusteConta">{({navigation,route})=>user ? <TelaAjusteConta key={`${user.id}:${route.key}`} usuarioLogado={user} secao={route.params.secao} existing={route.params.existing}
      onAbrirOpcao={secao=>navigation.push('AjusteConta',{secao})}
      onVoltar={()=>navigation.goBack()} onPerfil={()=>navigation.popTo('Perfil')}
      onBloquear={()=>lockSession().then(()=>reset(navigation,'Lista'))} onSair={()=>logout().then(()=>reset(navigation,'Lista'))}/>:missing(navigation)}</Stack.Screen>
    <Stack.Screen name="CadastroBar">{({navigation})=>podeCadastrarBar(user)?<TelaCadastroBar usuarioLogado={user} onVoltar={()=>navigation.goBack()} onAbrirCamera={openCamera(navigation)}
      onCadastrar={bar=>alterarBares(list=>[...list,{...bar,id:randomUUID(),proprietarios:[user.id]}])}/>:missing(navigation)}</Stack.Screen>
    <Stack.Screen name="GerenciarBar">{({navigation,route})=><TelaGerenciarBar bar={bares.find(b=>b.id===route.params.barId)} usuarioLogado={user}
      onVoltar={()=>navigation.goBack()} onConcluir={deleted=>{if(deleted)navigation.popTo('Lista');else navigation.goBack();}}
      onAbrirCamera={openCamera(navigation)}
      onSalvar={async(data,baseline)=>{await editarBar(route.params.barId,data,baseline,user?.id);await load();sync();}}
      onExcluir={async baseline=>{await excluirBar(route.params.barId,baseline,user?.id);await load();sync();}}/>}</Stack.Screen>
    <Stack.Screen name="DetalhesBar">{({navigation,route})=>{
      const bar=bares.find(b=>b.id===route.params.barId);
      return bar && podeInteragir(user)?<TelaDetalhesBar bar={bar} usuarioLogado={user} onVoltar={()=>navigation.goBack()} {...catalogActions}
        onGerenciarBar={()=>navigation.navigate('GerenciarBar',{barId:bar.id})}
        onAbrirItem={itemId=>navigation.navigate('DetalhesItem',{barId:bar.id,itemId})}
        onAbrirFormularioItem={item=>navigation.navigate('FormularioItem',{barId:bar.id,itemId:item?.id})}/>:missing(navigation);
    }}</Stack.Screen>
    <Stack.Screen name="DetalhesItem">{({navigation,route})=>{
      const bar=bares.find(b=>b.id===route.params.barId); const item=bar?.cardapio.find(i=>i.id===route.params.itemId);
      return item && podeInteragir(user)?<TelaDetalhesItem item={item} usuarioLogado={user} proprietarios={bar.proprietarios} podeAvaliar={podeAvaliar(user,bar)} onVoltar={()=>navigation.goBack()}
        onAvaliar={(i,r)=>safe(()=>changeBar(bar.id,b=>itemChange(b,i,t=>({...t,avaliacoes:[{...r,id:randomUUID()},...t.avaliacoes]}))))}
        onEditarAvaliacao={(i,r,d)=>safe(()=>changeBar(bar.id,b=>itemChange(b,i,t=>reviewsChange(t,r,d))))}
        onExcluirAvaliacao={(i,r)=>safe(()=>changeBar(bar.id,b=>itemChange(b,i,t=>({...t,avaliacoes:t.avaliacoes.filter(v=>v.id!==r)}))))}/>:missing(navigation);
    }}</Stack.Screen>
    <Stack.Screen name="FormularioItem">{({navigation,route})=>{
      const bar=bares.find(b=>b.id===route.params.barId); const item=bar?.cardapio.find(i=>i.id===route.params.itemId);
      return bar && podeGerenciarBar(user,bar)?<TelaFormularioItem itemExistente={item} onVoltar={()=>navigation.goBack()} onAbrirCamera={openCamera(navigation)}
        onSalvar={data=>changeBar(bar.id,b=>item?itemChange(b,item.id,t=>({...t,...data})):{...b,cardapio:[...b.cardapio,{...data,id:randomUUID(),criadoEm:new Date().toISOString(),avaliacoes:[]}]})}/>:missing(navigation);
    }}</Stack.Screen>
    <Stack.Screen name="Camera" component={CameraRoute}/>
  </Stack.Navigator></NavigationContainer></View></SafeAreaProvider>;
}
