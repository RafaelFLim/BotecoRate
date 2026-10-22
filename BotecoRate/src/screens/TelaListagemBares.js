import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { calcularNotaMedia } from '../utils/nota';
import { podeCadastrarBar } from '../utils/permissoes';

const MEDALHAS = ['🥇', '🥈', '🥉'];
export default function TelaListagemBares({ bares, usuarioLogado, onAbrirBar, onAbrirMapa, onAbrirCadastro, onAbrirPerfil, onEntrar, onSincronizar, onRevisarSincronizacao, statusSync }) {
  const ranking = [...bares].sort((a,b) => calcularNotaMedia(b.avaliacoes)-calcularNotaMedia(a.avaliacoes));
  const winners = ranking.filter(b => b.avaliacoes.some(r => r.elegivelRanking !== false)).slice(0,3).map(b=>b.id);
  return <SafeAreaView style={styles.container} edges={['top','bottom']}>
    <View style={styles.header}><Text style={styles.titulo}>BotecoRate</Text><View style={styles.botoesHeader}>
      <TouchableOpacity style={styles.btnMapa} onPress={onAbrirMapa}><Text style={styles.btnMapaText}>Mapa</Text></TouchableOpacity>
      {podeCadastrarBar(usuarioLogado) && <TouchableOpacity style={styles.btnNovoBar} onPress={onAbrirCadastro}><Text style={styles.btnMapaText}>+ Bar</Text></TouchableOpacity>}
      <TouchableOpacity style={styles.btnPerfil} onPress={usuarioLogado ? onAbrirPerfil : onEntrar}><Text style={styles.btnPerfilText}>{usuarioLogado ? usuarioLogado.usuario.charAt(0).toUpperCase() : '→'}</Text></TouchableOpacity>
    </View></View>
    <TouchableOpacity onPress={onSincronizar} style={{padding:12}}><Text>{statusSync || 'Atualizar catálogo'}</Text></TouchableOpacity>
    {usuarioLogado?.origem === 'firebase' && <TouchableOpacity onPress={onRevisarSincronizacao} style={{paddingHorizontal:12,paddingBottom:12}}><Text>Revisar envios e conflitos</Text></TouchableOpacity>}
    <FlatList data={ranking} keyExtractor={b=>b.id} contentContainerStyle={styles.lista}
      ListEmptyComponent={<Text>Nenhum bar disponível neste aparelho. Conecte-se para atualizar o catálogo.</Text>}
      renderItem={({item:bar})=><TouchableOpacity style={styles.card} onPress={()=>onAbrirBar(bar.id)}>
        {bar.foto && <Image style={styles.foto} source={{uri:bar.foto}}/>}
        {winners.includes(bar.id) && <View style={styles.seloMedalha}><Text>{MEDALHAS[winners.indexOf(bar.id)]}</Text></View>}
        <View style={styles.infoCard}><Text style={styles.nomeBar}>{bar.nome}</Text><Text style={styles.enderecoBar}>{bar.endereco}</Text><Text style={styles.notaBar}>⭐ {calcularNotaMedia(bar.avaliacoes).toFixed(1)}</Text></View>
      </TouchableOpacity>}/>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#1a1a2e',
  },
  titulo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    padding: 2,
  },
  botoesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  btnMapa: {
    backgroundColor: '#2e86de',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 10,
  },
  btnNovoBar: {
    backgroundColor: '#27ae60',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  btnPerfil: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6c63ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  btnPerfilText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  btnMapaText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  lista: {
    padding: 16,
  },
  avisoBoasVindas: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    backgroundColor: '#27ae60',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    elevation: 4,
  },
  avisoBoasVindasTexto: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 14,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  foto: {
    width: 96,
    // Sem altura fixa: a imagem estica junto com o card quando o endereço
    // quebra em duas linhas, em vez de deixar uma faixa branca embaixo.
    alignSelf: 'stretch',
    minHeight: 96,
  },
  seloMedalha: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  seloMedalhaTexto: {
    fontSize: 15,
  },
  infoCard: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  nomeBar: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: 4,
  },
  enderecoBar: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
  },
  notaBar: {
    fontSize: 13,
    color: '#333',
    fontWeight: '600',
  },
});
