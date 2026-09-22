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
import TelaPerfil from './TelaPerfil';

// Medalha dos 3 bares mais bem avaliados, no estilo do ranking do Comida di
// Buteco. Só entra na disputa quem já tem avaliação — bar zerado não ganha ouro.
const MEDALHAS = ['🥇', '🥈', '🥉'];

function CardBar({ bar, medalha, onAbrir }) {
  const notaMedia = calcularNotaMedia(bar.avaliacoes);

  return (
    <TouchableOpacity style={styles.card} onPress={onAbrir}>
      <Image style={styles.foto} source={{ uri: bar.foto }} />
      {medalha && (
        <View style={styles.seloMedalha}>
          <Text style={styles.seloMedalhaTexto}>{medalha}</Text>
        </View>
      )}
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
  onSenhaAlterada,
}) {
  const [bares, setBares] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [barSelecionadoId, setBarSelecionadoId] = useState(null);
  const [mostrarCadastro, setMostrarCadastro] = useState(false);
  const [mostrarPerfil, setMostrarPerfil] = useState(false);

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

    if (dadosSalvos === null) {
      setBares(baresIniciais);
      await salvarBares(baresIniciais);
      setCarregando(false);
      return;
    }

    const baresDoSeedPorId = new Map(baresIniciais.map((bar) => [bar.id, bar]));
    let precisaSalvar = false;

    // Bar salvo antes de detalhes/cardápio/criadoPor existirem (mesmo id do
    // mockBares.js, mas gravado num app mais antigo) fica sem esses campos —
    // completa com o que o seed tem, sem mexer no que a pessoa já editou
    // (avaliações, foto, etc.).
    const listaCompletada = dadosSalvos.map((bar) => {
      const barDoSeed = baresDoSeedPorId.get(bar.id);

      if (!barDoSeed) {
        return bar;
      }

      const completado = { ...bar };

      if (completado.detalhes === undefined) {
        completado.detalhes = barDoSeed.detalhes;
        precisaSalvar = true;
      }

      if (completado.cardapio === undefined) {
        completado.cardapio = barDoSeed.cardapio;
        precisaSalvar = true;
      }

      if (completado.criadoPor === undefined) {
        completado.criadoPor = barDoSeed.criadoPor;
        precisaSalvar = true;
      }

      return completado;
    });

    // Bar novo adicionado no mockBares.js depois que o aparelho já tinha dados
    // salvos (comum durante o desenvolvimento) não aparecia sozinho — o app só
    // lia o AsyncStorage e ignorava o seed inteiro. Aqui ele entra automático.
    const idsSalvos = new Set(dadosSalvos.map((bar) => bar.id));
    const baresNovosDoSeed = baresIniciais.filter((bar) => !idsSalvos.has(bar.id));

    const listaFinal =
      baresNovosDoSeed.length > 0 ? [...listaCompletada, ...baresNovosDoSeed] : listaCompletada;

    setBares(listaFinal);

    if (precisaSalvar || baresNovosDoSeed.length > 0) {
      await salvarBares(listaFinal);
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

  async function editarAvaliacao(barId, avaliacaoId, dadosAtualizados) {
    const agora = new Date().toISOString();

    const novaLista = bares.map((bar) => {
      if (bar.id !== barId) {
        return bar;
      }

      return {
        ...bar,
        avaliacoes: bar.avaliacoes.map((avaliacao) => {
          if (avaliacao.id !== avaliacaoId) {
            return avaliacao;
          }

          // Guarda nota + comentário de antes da edição no histórico, pra dar
          // pra ver como a opinião do usuário sobre o bar mudou com o tempo.
          const versaoAnterior = {
            nota: avaliacao.nota,
            comentario: avaliacao.comentario,
            data: avaliacao.editadoEm || avaliacao.criadoEm,
          };

          return {
            ...avaliacao,
            ...dadosAtualizados,
            editadoEm: agora,
            historico: [...(avaliacao.historico || []), versaoAnterior],
          };
        }),
      };
    });

    setBares(novaLista);
    await salvarBares(novaLista);
  }

  async function excluirAvaliacao(barId, avaliacaoId) {
    const novaLista = bares.map((bar) => {
      if (bar.id !== barId) {
        return bar;
      }

      return {
        ...bar,
        avaliacoes: bar.avaliacoes.filter((avaliacao) => avaliacao.id !== avaliacaoId),
      };
    });

    setBares(novaLista);
    await salvarBares(novaLista);
  }

  // Adiciona um item novo ao cardápio de um bar que já existe (só o dono do bar
  // pode chegar nessa ação — a trava é feita na tela, aqui só persiste).
  async function adicionarItemCardapio(barId, novoItem) {
    const novaLista = bares.map((bar) => {
      if (bar.id !== barId) {
        return bar;
      }

      return { ...bar, cardapio: [...(bar.cardapio || []), novoItem] };
    });

    setBares(novaLista);
    await salvarBares(novaLista);
  }

  // Edita um item do cardápio (não é a avaliação do item — é nome/descrição/
  // valor/tipo/foto do item em si). Mesmo padrão de editarAvaliacao: guarda a
  // versão anterior no histórico do item antes de sobrescrever.
  async function editarItemCardapio(barId, itemId, dadosAtualizados) {
    const agora = new Date().toISOString();

    const novaLista = bares.map((bar) => {
      if (bar.id !== barId) {
        return bar;
      }

      return {
        ...bar,
        cardapio: bar.cardapio.map((item) => {
          if (item.id !== itemId) {
            return item;
          }

          const versaoAnterior = {
            tipo: item.tipo,
            nome: item.nome,
            descricao: item.descricao,
            valor: item.valor,
            foto: item.foto,
            data: item.editadoEm || item.criadoEm,
          };

          return {
            ...item,
            ...dadosAtualizados,
            editadoEm: agora,
            historico: [...(item.historico || []), versaoAnterior],
          };
        }),
      };
    });

    setBares(novaLista);
    await salvarBares(novaLista);
  }

  async function excluirItemCardapio(barId, itemId) {
    const novaLista = bares.map((bar) => {
      if (bar.id !== barId) {
        return bar;
      }

      return {
        ...bar,
        cardapio: bar.cardapio.filter((item) => item.id !== itemId),
      };
    });

    setBares(novaLista);
    await salvarBares(novaLista);
  }

  // As três funções abaixo são o mesmo padrão de adicionarAvaliacao/editarAvaliacao/
  // excluirAvaliacao, só que um nível mais fundo: a avaliação é de um item do
  // cardápio (bar.cardapio[].avaliacoes), não do bar em si.
  async function adicionarAvaliacaoItem(barId, itemId, novaAvaliacao) {
    const novaLista = bares.map((bar) => {
      if (bar.id !== barId) {
        return bar;
      }

      return {
        ...bar,
        cardapio: bar.cardapio.map((item) =>
          item.id === itemId
            ? { ...item, avaliacoes: [novaAvaliacao, ...item.avaliacoes] }
            : item
        ),
      };
    });

    setBares(novaLista);
    await salvarBares(novaLista);
  }

  async function editarAvaliacaoItem(barId, itemId, avaliacaoId, dadosAtualizados) {
    const agora = new Date().toISOString();

    const novaLista = bares.map((bar) => {
      if (bar.id !== barId) {
        return bar;
      }

      return {
        ...bar,
        cardapio: bar.cardapio.map((item) => {
          if (item.id !== itemId) {
            return item;
          }

          return {
            ...item,
            avaliacoes: item.avaliacoes.map((avaliacao) => {
              if (avaliacao.id !== avaliacaoId) {
                return avaliacao;
              }

              const versaoAnterior = {
                nota: avaliacao.nota,
                comentario: avaliacao.comentario,
                data: avaliacao.editadoEm || avaliacao.criadoEm,
              };

              return {
                ...avaliacao,
                ...dadosAtualizados,
                editadoEm: agora,
                historico: [...(avaliacao.historico || []), versaoAnterior],
              };
            }),
          };
        }),
      };
    });

    setBares(novaLista);
    await salvarBares(novaLista);
  }

  async function excluirAvaliacaoItem(barId, itemId, avaliacaoId) {
    const novaLista = bares.map((bar) => {
      if (bar.id !== barId) {
        return bar;
      }

      return {
        ...bar,
        cardapio: bar.cardapio.map((item) => {
          if (item.id !== itemId) {
            return item;
          }

          return {
            ...item,
            avaliacoes: item.avaliacoes.filter((avaliacao) => avaliacao.id !== avaliacaoId),
          };
        }),
      };
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
        usuarioLogado={usuarioLogado}
        onVoltar={() => setMostrarCadastro(false)}
        onCadastrar={async () => {
          setMostrarCadastro(false);
          await carregarListaDeBares();
        }}
      />
    );
  }

  if (mostrarPerfil) {
    return (
      <TelaPerfil
        usuarioLogado={usuarioLogado}
        onVoltar={() => setMostrarPerfil(false)}
        onSenhaAlterada={onSenhaAlterada}
        onSair={onSair}
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
        onEditarAvaliacao={editarAvaliacao}
        onExcluirAvaliacao={excluirAvaliacao}
        onAdicionarItemCardapio={adicionarItemCardapio}
        onEditarItemCardapio={editarItemCardapio}
        onExcluirItemCardapio={excluirItemCardapio}
        onAvaliarItem={adicionarAvaliacaoItem}
        onEditarAvaliacaoItem={editarAvaliacaoItem}
        onExcluirAvaliacaoItem={excluirAvaliacaoItem}
        onDefinirLocalizacao={definirLocalizacaoDoBar}
      />
    );
  }

  // A lista vira o próprio ranking: do maior pro menor nota média. Só quem já
  // tem avaliação disputa medalha — um bar zerado não pode ficar em 1º lugar.
  const baresRanking = [...bares].sort(
    (a, b) => calcularNotaMedia(b.avaliacoes) - calcularNotaMedia(a.avaliacoes)
  );
  const idsComMedalha = baresRanking
    .filter((bar) => bar.avaliacoes.length > 0)
    .slice(0, 3)
    .map((bar) => bar.id);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
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
          <TouchableOpacity style={styles.btnPerfil} onPress={() => setMostrarPerfil(true)}>
            <Text style={styles.btnPerfilText}>
              {usuarioLogado.usuario.charAt(0).toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={baresRanking}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CardBar
            bar={item}
            medalha={MEDALHAS[idsComMedalha.indexOf(item.id)]}
            onAbrir={() => setBarSelecionadoId(item.id)}
          />
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
