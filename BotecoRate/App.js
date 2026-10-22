import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { randomUUID } from 'expo-crypto';
import TelaLogin from './src/screens/TelaLogin';
import TelaCadastroUsuario from './src/screens/TelaCadastroUsuario';
import TelaBiometria from './src/screens/TelaBiometria';
import TelaListagemBares from './src/screens/TelaListagemBares';
import TelaMapaGPS from './src/screens/TelaMapaGPS';
import TelaPerfil from './src/screens/TelaPerfil';
import TelaDetalhesBar from './src/screens/TelaDetalhesBar';
import TelaDetalhesItem from './src/screens/TelaDetalhesItem';
import TelaCadastroBar from './src/screens/TelaCadastroBar';
import TelaFormularioItem from './src/screens/TelaFormularioItem';
import TelaCamera from './src/screens/TelaCamera';
import { Formulario, Botao, Aviso } from './src/components/Formulario';
import { migrateLegacyData } from './src/database/legacyMigration';
import { carregarBares, alterarBares, subscribeCatalog } from './src/services/storage';
import { subscribeSession, getActiveUser, logout, unlockPersistedSession } from './src/services/authService';
import { syncCatalog } from './src/services/syncService';
import { persistPhoto } from './src/services/mediaService';
import { podeInteragir, podeAvaliar, podeCadastrarBar, podeGerenciarBar } from './src/utils/permissoes';

const Stack = createNativeStackNavigator();
const photoRequests = new Map();

function CameraRoute({ navigation, route }) {
  useEffect(() => () => { photoRequests.delete(route.params.requestId); }, [route.params.requestId]);
  return <TelaCamera onVoltar={() => navigation.goBack()} onFotoCapturada={async uri => {
    try {
      const photo = await persistPhoto(uri);
      photoRequests.get(route.params.requestId)?.(photo);
      navigation.goBack();
    } catch (error) { Alert.alert('Não foi possível guardar a foto', error.message); }
  }} />;
}

export default function App() {
  const [ready, setReady] = useState(false); const [startupError, setStartupError] = useState('');
  const [user, setUser] = useState(getActiveUser()); const [bares, setBares] = useState([]);
  const [statusSync, setStatusSync] = useState('Consulta local');
  async function load() { setBares(await carregarBares()); }
  async function start() {
    setStartupError('');
    try { await migrateLegacyData(); await load(); setReady(true); }
    catch (error) { setStartupError(error.message); }
  }
  async function sync() {
    try { setStatusSync('Atualizando...'); setStatusSync(await syncCatalog()); await load(); }
    catch (error) { setStatusSync('Não foi possível atualizar: ' + error.message); }
  }
  useEffect(() => {
    start();
    const stopUser = subscribeSession(setUser);
    const stopCatalog = subscribeCatalog(() => { load().catch(error=>setStartupError(error.message)); });
    return () => { stopUser(); stopCatalog(); };
  }, []);
  useEffect(() => {
    if (!ready) return;
    sync();
    return NetInfo.addEventListener(state => { if (state.isConnected && state.isInternetReachable !== false) sync(); });
  }, [ready]);
  async function changeBar(id, transform) {
    await alterarBares(list => list.map(bar => bar.id === id ? transform(bar) : bar));
    await load();
  }
  function itemChange(bar, itemId, transform) { return {...bar,cardapio:bar.cardapio.map(item=>item.id===itemId?transform(item):item)}; }
  function reviewsChange(target, id, data) { return {...target,avaliacoes:target.avaliacoes.map(r=>r.id===id?{...r,...data}:r)}; }
  async function safe(action) {
    try { await action(); return true; }
    catch(error) { Alert.alert('Não foi possível salvar',error.message); return false; }
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
  const missing = navigation => <Formulario title="Conteúdo indisponível" onVoltar={()=>navigation.goBack()}><Aviso>Atualize a lista para continuar.</Aviso></Formulario>;
  if (!ready) return <SafeAreaProvider><Formulario title="Preparando o BotecoRate">
    {startupError ? <><Aviso>{startupError}</Aviso><Botao onPress={start}>Tentar novamente sem apagar os dados</Botao></> : <><ActivityIndicator/><Aviso>Preparando o banco e protegendo as contas locais. A primeira abertura pode levar alguns instantes.</Aviso></>}
  </Formulario></SafeAreaProvider>;
  return <SafeAreaProvider><NavigationContainer><Stack.Navigator initialRouteName="Login" screenOptions={{headerShown:false,gestureEnabled:true}}>
    <Stack.Screen name="Login">{({navigation})=><TelaLogin onEntrar={()=>reset(navigation,'Lista')} onConsultar={()=>navigation.navigate('Lista')} onAbrirCadastro={()=>navigation.navigate('CadastroUsuario')} onEntrarComBiometria={()=>navigation.navigate('Biometria')}/>}</Stack.Screen>
    <Stack.Screen name="CadastroUsuario">{({navigation})=><TelaCadastroUsuario onVoltar={()=>navigation.goBack()} onCadastrar={()=>reset(navigation,getActiveUser()?'Lista':'Login')}/>}</Stack.Screen>
    <Stack.Screen name="Biometria" options={{gestureEnabled:false}}>{({navigation})=><TelaBiometria onVoltar={()=>navigation.goBack()} onEntrar={()=>unlockPersistedSession().then(()=>reset(navigation,'Lista')).catch(e=>Alert.alert('Entre novamente',e.message))}/>}</Stack.Screen>
    <Stack.Screen name="Lista">{({navigation})=><TelaListagemBares bares={bares} usuarioLogado={user} statusSync={statusSync} onSincronizar={sync}
      onAbrirMapa={()=>navigation.navigate('Mapa')} onAbrirPerfil={()=>navigation.navigate('Perfil')} onEntrar={()=>reset(navigation,'Login')}
      onAbrirCadastro={()=>navigation.navigate('CadastroBar')}
      onAbrirBar={id=>podeInteragir(user)?navigation.navigate('DetalhesBar',{barId:id}):Alert.alert('Somente consulta','Entre com uma conta e verifique seu e-mail para acessar cardápios e avaliações.')}/>}</Stack.Screen>
    <Stack.Screen name="Mapa">{({navigation})=><TelaMapaGPS onVoltar={()=>navigation.goBack()}/>}</Stack.Screen>
    <Stack.Screen name="Perfil">{({navigation})=><TelaPerfil usuarioLogado={user} onVoltar={()=>navigation.goBack()} onSair={()=>logout().then(()=>reset(navigation,'Login')).catch(e=>Alert.alert('Erro',e.message))}/>}</Stack.Screen>
    <Stack.Screen name="CadastroBar">{({navigation})=>podeCadastrarBar(user)?<TelaCadastroBar usuarioLogado={user} onVoltar={()=>navigation.goBack()} onAbrirCamera={openCamera(navigation)}
      onCadastrar={bar=>alterarBares(list=>[...list,{...bar,id:randomUUID(),proprietarios:[user.id]}])}/>:missing(navigation)}</Stack.Screen>
    <Stack.Screen name="DetalhesBar">{({navigation,route})=>{
      const bar=bares.find(b=>b.id===route.params.barId);
      return bar && podeInteragir(user)?<TelaDetalhesBar bar={bar} usuarioLogado={user} onVoltar={()=>navigation.goBack()} {...catalogActions}
        onAbrirItem={itemId=>navigation.navigate('DetalhesItem',{barId:bar.id,itemId})}
        onAbrirFormularioItem={item=>navigation.navigate('FormularioItem',{barId:bar.id,itemId:item?.id})}/>:missing(navigation);
    }}</Stack.Screen>
    <Stack.Screen name="DetalhesItem">{({navigation,route})=>{
      const bar=bares.find(b=>b.id===route.params.barId); const item=bar?.cardapio.find(i=>i.id===route.params.itemId);
      return item && podeInteragir(user)?<TelaDetalhesItem item={item} usuarioLogado={user} podeAvaliar={podeAvaliar(user,bar)} onVoltar={()=>navigation.goBack()}
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
  </Stack.Navigator></NavigationContainer></SafeAreaProvider>;
}
