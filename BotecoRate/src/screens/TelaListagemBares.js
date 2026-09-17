import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { carregarBares, salvarBares } from '../services/storage';
import { baresIniciais } from '../data/mockBares';
import { calcularNotaMedia } from '../utils/nota';
import TelaDetalhesBar from './TelaDetalhesBar';
import TelaCadastroBar from './TelaCadastroBar';

function CardBar({ bar, onAbrir }) {
  const notaMedia = calcularNotaMedia(bar.avaliacoes);

  return (
    <TouchableOpacity style={styles.card} onPress={onAbrir}>
      <Image style={styles.foto} source={{ uri: bar.foto }} />
      <View style={styles.infoCard}>
        <Text style={styles.nomeBar}>{bar.nome}</Text>
        <Text style={styles.enderecoBar}>{bar.endereco}</Text>
        <Text style={styles.notaBar}>
          ⭐ {notaMedia.toFixed(1)} ({bar.avaliacoes.length} avaliações)
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function TelaListagemBares({
  usuarioLogado,
  mensagemBoasVindas,
  onFecharBoasVindas,
  onAbrirMapa,
  onSair,
}) {
  const [bares, setBares] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [barSelecionadoId, setBarSelecionadoId] = useState(null);
  const [mostrarCadastro, setMostrarCadastro] = useState(false);

  useEffect(() => {
    carregarListaDeBares();
  }, []);

  // O aviso de boas-vindas fica 2 segundos na tela e some sozinho.
  useEffect(() => {
    if (mensagemBoasVindas === null) {
      return;
    }

    const tempo = setTimeout(onFecharBoasVindas, 2000);
    return () => clearTimeout(tempo);
  }, [mensagemBoasVindas]);

  async function carregarListaDeBares() {
    const dadosSalvos = await carregarBares();

    if (dadosSalvos !== null) {
      setBares(dadosSalvos);
    } else {
      setBares(baresIniciais);
      await salvarBares(baresIniciais);
    }

    setCarregando(false);
  }

  async function adicionarAvaliacao(barId, novaAvaliacao) {
    const novaLista = bares.map((bar) => {
      if (bar.id === barId) {
        return { ...bar, avaliacoes: [novaAvaliacao, ...bar.avaliacoes] };
      }

      return bar;
    });

    setBares(novaLista);
    await salvarBares(novaLista);
  }

  async function definirLocalizacaoDoBar(barId, coordenadas) {
    const novaLista = bares.map((bar) => {
      if (bar.id === barId) {
        return {
          ...bar,
          latitude: coordenadas.latitude,
          longitude: coordenadas.longitude,
        };
      }

      return bar;
    });

    setBares(novaLista);
    await salvarBares(novaLista);
  }

  if (carregando) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6c63ff" />
      </View>
    );
  }

  if (mostrarCadastro) {
    return (
      <TelaCadastroBar
        onVoltar={() => setMostrarCadastro(false)}
        onCadastrar={async () => {
          setMostrarCadastro(false);
          await carregarListaDeBares();
        }}
      />
    );
  }

  const barSelecionado = bares.find((bar) => bar.id === barSelecionadoId);

  if (barSelecionado) {
    return (
      <TelaDetalhesBar
        bar={barSelecionado}
        usuarioLogado={usuarioLogado}
        onVoltar={() => setBarSelecionadoId(null)}
        onAvaliar={adicionarAvaliacao}
        onDefinirLocalizacao={definirLocalizacaoDoBar}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="auto" />

      <View style={styles.header}>
        <Text style={styles.titulo}>BotecoRate</Text>
        <View style={styles.botoesHeader}>
          <TouchableOpacity style={styles.btnMapa} onPress={onAbrirMapa}>
            <Text style={styles.btnMapaText}>🗺️ Mapa</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnNovoBar} onPress={() => setMostrarCadastro(true)}>
            <Text style={styles.btnMapaText}>+ Bar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnSair} onPress={onSair}>
            <Text style={styles.btnSairText}>Sair</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={bares}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CardBar bar={item} onAbrir={() => setBarSelecionadoId(item.id)} />
        )}
        contentContainerStyle={styles.lista}
      />

      {mensagemBoasVindas !== null && (
        <View style={styles.avisoBoasVindas}>
          <Text style={styles.avisoBoasVindasTexto}>{mensagemBoasVindas}</Text>
        </View>
      )}
    </SafeAreaView>
  );
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
    paddingVertical: 16,
    backgroundColor: '#1a1a2e',
  },
  titulo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  botoesHeader: {
    flexDirection: 'row',
  },
  btnMapa: {
    backgroundColor: '#2e86de',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 8,
  },
  btnNovoBar: {
    backgroundColor: '#27ae60',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  btnSair: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginLeft: 4,
  },
  btnSairText: {
    color: '#ff8a80',
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
