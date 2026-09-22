import { useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { calcularNotaMedia } from '../utils/nota';
import { formatarDataHora } from '../utils/data';
import TelaDetalhesItem from './TelaDetalhesItem';
import TelaFormularioItem from './TelaFormularioItem';

function SeletorDeNota({ notaSelecionada, onSelecionar }) {
  return (
    <View style={styles.seletorNota}>
      {[1, 2, 3, 4, 5].map((valor) => (
        <TouchableOpacity
          key={valor}
          style={[
            styles.estrelaBotao,
            notaSelecionada === valor && styles.estrelaBotaoSelecionada,
          ]}
          onPress={() => onSelecionar(valor)}
        >
          <Text
            style={[
              styles.estrelaTexto,
              notaSelecionada === valor && styles.estrelaTextoSelecionada,
            ]}
          >
            {valor} ⭐
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function ItemAvaliacao({ avaliacao, ehPropria, onEditar, onExcluir }) {
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const temHistorico = avaliacao.historico && avaliacao.historico.length > 0;

  return (
    <View style={styles.itemAvaliacao}>
      <View style={styles.itemTopo}>
        <Text style={styles.itemNota}>⭐ {avaliacao.nota}</Text>
        {ehPropria && (
          <View style={styles.itemAcoes}>
            <TouchableOpacity onPress={onEditar}>
              <Text style={styles.itemAcaoTexto}>✏️</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onExcluir} style={styles.itemAcaoExcluir}>
              <Text style={styles.itemAcaoTexto}>🗑️</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      <Text style={styles.itemComentario}>{avaliacao.comentario}</Text>

      <View style={styles.itemRodape}>
        {/* As avaliações de exemplo (mockBares) não têm autor. */}
        <Text style={styles.itemAutor}>
          por {avaliacao.autor ? avaliacao.autor : 'anônimo'}
        </Text>
        {/* Mostra a data mais recente (a da edição, se já foi editada). Avaliações
            antigas, de antes dessa tela guardar data, ficam sem data mesmo. */}
        {(avaliacao.editadoEm || avaliacao.criadoEm) && (
          <Text style={styles.itemData}>
            {formatarDataHora(avaliacao.editadoEm || avaliacao.criadoEm)}
            {avaliacao.editadoEm ? ' (editado)' : ''}
          </Text>
        )}
      </View>

      {temHistorico && (
        <TouchableOpacity onPress={() => setHistoricoAberto(!historicoAberto)}>
          <Text style={styles.itemVerHistorico}>
            {historicoAberto
              ? 'Ocultar histórico de edições ▲'
              : `Ver histórico de edições (${avaliacao.historico.length}) ▼`}
          </Text>
        </TouchableOpacity>
      )}

      {historicoAberto && (
        <View style={styles.historico}>
          {avaliacao.historico.map((versao, indice) => (
            <View key={indice} style={styles.historicoItem}>
              <Text style={styles.historicoNota}>⭐ {versao.nota}</Text>
              <Text style={styles.historicoComentario}>{versao.comentario}</Text>
              <Text style={styles.historicoData}>{formatarDataHora(versao.data)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function TelaDetalhesBar({
  bar,
  usuarioLogado,
  onVoltar,
  onAvaliar,
  onEditarAvaliacao,
  onExcluirAvaliacao,
  onAdicionarItemCardapio,
  onEditarItemCardapio,
  onExcluirItemCardapio,
  onAvaliarItem,
  onEditarAvaliacaoItem,
  onExcluirAvaliacaoItem,
  onDefinirLocalizacao,
}) {
  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState('');
  const [posicionando, setPosicionando] = useState(false);
  const [avaliacaoEditandoId, setAvaliacaoEditandoId] = useState(null);
  const [itemSelecionadoId, setItemSelecionadoId] = useState(null);
  const [mostrandoFormularioItem, setMostrandoFormularioItem] = useState(false);
  // null = criando item novo; id = editando esse item existente do cardápio.
  const [itemEditandoIdCardapio, setItemEditandoIdCardapio] = useState(null);

  const notaMedia = calcularNotaMedia(bar.avaliacoes);
  // Bares antigos (cadastrados antes do cardápio existir, ou os de mock) ficam
  // sem cardápio mesmo — a tela lida com isso em vez de quebrar.
  const cardapio = bar.cardapio || [];
  // Só quem cadastrou o bar pode completar o cardápio dele depois. Bar antigo,
  // criado antes de existir esse campo, não tem dono registrado — nesse caso
  // libera pra quem estiver logado, senão ele fica travado sem cardápio pra sempre.
  const ehDono =
    usuarioLogado !== null && (!bar.criadoPor || bar.criadoPor === usuarioLogado.usuario);

  // Cada usuário só pode ter uma avaliação por bar: se já existe uma com o
  // nome dele, o formulário de nova avaliação fica bloqueado.
  const avaliacaoDoUsuario = usuarioLogado
    ? bar.avaliacoes.find((avaliacao) => avaliacao.autor === usuarioLogado.usuario)
    : null;

  // Bar cadastrado com o GPS desligado fica sem coordenada e não entra no mapa.
  // Aqui ele pode ser posicionado depois, sem precisar cadastrar de novo.
  async function adicionarAoMapa() {
    setPosicionando(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Atenção', 'Precisamos da permissão de localização para posicionar o bar.');
        setPosicionando(false);
        return;
      }

      // Primeiro tentamos converter o endereço digitado em coordenadas — assim dá
      // pra posicionar o bar mesmo estando longe dele. Se o endereço for vago
      // demais (ou a busca falhar), usamos a localização atual do aparelho.
      let encontrados = [];

      try {
        encontrados = await Location.geocodeAsync(bar.endereco);
      } catch (error) {
        console.log('Não foi possível converter o endereço em coordenadas:', error);
      }

      if (encontrados.length > 0) {
        await onDefinirLocalizacao(bar.id, encontrados[0]);
        setPosicionando(false);
        Alert.alert('Pronto!', 'O bar foi posicionado no mapa pelo endereço.');
        return;
      }

      const servicosLigados = await Location.hasServicesEnabledAsync();

      if (!servicosLigados) {
        Alert.alert(
          'Atenção',
          'Não encontramos esse endereço no mapa. Ligue o GPS para usar sua localização atual, ' +
            'ou edite o endereço do bar.'
        );
        setPosicionando(false);
        return;
      }

      const posicao = await Location.getCurrentPositionAsync({});
      await onDefinirLocalizacao(bar.id, posicao.coords);
      setPosicionando(false);
      Alert.alert('Pronto!', 'O bar foi posicionado na sua localização atual.');
    } catch (error) {
      console.log('Erro ao posicionar o bar no mapa:', error);
      Alert.alert('Erro', 'Não foi possível posicionar o bar no mapa. Tente de novo.');
      setPosicionando(false);
    }
  }

  function enviarAvaliacao() {
    if (nota === 0) {
      Alert.alert('Atenção', 'Selecione uma nota de 1 a 5 estrelas.');
      return;
    }

    if (avaliacaoEditandoId !== null) {
      onEditarAvaliacao(bar.id, avaliacaoEditandoId, {
        nota,
        comentario: comentario.trim() || 'Sem comentário.',
      });
      cancelarEdicao();
      return;
    }

    const novaAvaliacao = {
      id: Date.now().toString(),
      nota,
      comentario: comentario.trim() || 'Sem comentário.',
      autor: usuarioLogado ? usuarioLogado.usuario : 'anônimo',
      criadoEm: new Date().toISOString(),
      editadoEm: null,
      historico: [],
    };

    onAvaliar(bar.id, novaAvaliacao);
    setNota(0);
    setComentario('');
  }

  function iniciarEdicao(avaliacao) {
    setAvaliacaoEditandoId(avaliacao.id);
    setNota(avaliacao.nota);
    setComentario(avaliacao.comentario);
  }

  function cancelarEdicao() {
    setAvaliacaoEditandoId(null);
    setNota(0);
    setComentario('');
  }

  function confirmarExclusao(avaliacao) {
    Alert.alert('Excluir avaliação', 'Tem certeza que quer excluir sua avaliação?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => {
          onExcluirAvaliacao(bar.id, avaliacao.id);

          if (avaliacaoEditandoId === avaliacao.id) {
            cancelarEdicao();
          }
        },
      },
    ]);
  }

  function fecharFormularioItem() {
    setMostrandoFormularioItem(false);
    setItemEditandoIdCardapio(null);
  }

  function iniciarEdicaoItem(item) {
    setItemEditandoIdCardapio(item.id);
    setMostrandoFormularioItem(true);
  }

  function confirmarExclusaoItem(item) {
    Alert.alert('Excluir item', `Tem certeza que quer excluir "${item.nome}" do cardápio?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => onExcluirItemCardapio(bar.id, item.id),
      },
    ]);
  }

  if (mostrandoFormularioItem) {
    const itemParaEditar = cardapio.find((item) => item.id === itemEditandoIdCardapio);

    return (
      <TelaFormularioItem
        itemExistente={itemParaEditar}
        onVoltar={fecharFormularioItem}
        onSalvar={(dados) => {
          if (itemParaEditar) {
            onEditarItemCardapio(bar.id, itemParaEditar.id, dados);
          } else {
            onAdicionarItemCardapio(bar.id, {
              id: Date.now().toString(),
              ...dados,
              criadoEm: new Date().toISOString(),
              editadoEm: null,
              historico: [],
              avaliacoes: [],
            });
          }

          fecharFormularioItem();
        }}
      />
    );
  }

  const itemSelecionado = cardapio.find((item) => item.id === itemSelecionadoId);

  if (itemSelecionado) {
    return (
      <TelaDetalhesItem
        item={itemSelecionado}
        usuarioLogado={usuarioLogado}
        onVoltar={() => setItemSelecionadoId(null)}
        onAvaliar={(itemId, novaAvaliacao) => onAvaliarItem(bar.id, itemId, novaAvaliacao)}
        onEditarAvaliacao={(itemId, avaliacaoId, dados) =>
          onEditarAvaliacaoItem(bar.id, itemId, avaliacaoId, dados)
        }
        onExcluirAvaliacao={(itemId, avaliacaoId) =>
          onExcluirAvaliacaoItem(bar.id, itemId, avaliacaoId)
        }
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onVoltar}>
          <Text style={styles.btnVoltarTexto}>← Voltar</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.conteudo}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          data={bar.avaliacoes}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ItemAvaliacao
              avaliacao={item}
              ehPropria={usuarioLogado !== null && item.autor === usuarioLogado.usuario}
              onEditar={() => iniciarEdicao(item)}
              onExcluir={() => confirmarExclusao(item)}
            />
          )}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View>
              <Image style={styles.foto} source={{ uri: bar.foto }} />

              <View style={styles.infoBar}>
                <Text style={styles.nomeBar}>{bar.nome}</Text>
                <Text style={styles.enderecoBar}>{bar.endereco}</Text>
                <Text style={styles.notaMedia}>
                  ⭐ {notaMedia.toFixed(1)} ({bar.avaliacoes.length} avaliações)
                </Text>

                {typeof bar.latitude !== 'number' && (
                  <>
                    <Text style={styles.avisoSemMapa}>
                      ⚠️ Este bar foi cadastrado sem localização, então ainda não aparece no mapa.
                    </Text>
                    <TouchableOpacity
                      style={[styles.btnAdicionarAoMapa, posicionando && styles.btnDesabilitado]}
                      onPress={adicionarAoMapa}
                      disabled={posicionando}
                    >
                      <Text style={styles.btnAdicionarAoMapaTexto}>
                        {posicionando ? 'Posicionando...' : '📍 Adicionar ao mapa'}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>

              {bar.detalhes && (
                <View style={styles.secaoDetalhes}>
                  <Text style={styles.subtitulo}>Detalhes</Text>
                  <Text style={styles.textoDetalhes}>{bar.detalhes}</Text>
                </View>
              )}

              <View style={styles.cardapioHeader}>
                <Text style={styles.subtitulo}>Cardápio</Text>
                {ehDono && (
                  <TouchableOpacity
                    style={styles.btnAdicionarItemCardapio}
                    onPress={() => {
                      setItemEditandoIdCardapio(null);
                      setMostrandoFormularioItem(true);
                    }}
                  >
                    <Text style={styles.btnAdicionarItemCardapioTexto}>+ Item</Text>
                  </TouchableOpacity>
                )}
              </View>
              {cardapio.length === 0 ? (
                <Text style={styles.cardapioVazio}>Nenhum item cadastrado ainda.</Text>
              ) : (
                <View style={styles.cardapioLista}>
                  {cardapio.map((item) => {
                    const notaMediaItem = calcularNotaMedia(item.avaliacoes);

                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.itemCardapio}
                        onPress={() => setItemSelecionadoId(item.id)}
                      >
                        {item.foto ? (
                          <Image style={styles.fotoItemCardapio} source={{ uri: item.foto }} />
                        ) : (
                          <View style={styles.fotoItemCardapioPlaceholder}>
                            <Text style={styles.fotoItemCardapioPlaceholderTexto}>
                              {item.tipo === 'bebida' ? '🍺' : '🍢'}
                            </Text>
                          </View>
                        )}
                        <View style={styles.infoItemCardapio}>
                          <Text style={styles.nomeItemCardapio}>{item.nome}</Text>
                          <Text style={styles.notaItemCardapio}>
                            ⭐ {notaMediaItem.toFixed(1)} ({item.avaliacoes.length})
                          </Text>
                        </View>
                        <Text style={styles.valorItemCardapio}>
                          R$ {item.valor.toFixed(2).replace('.', ',')}
                        </Text>
                        {ehDono && (
                          <View style={styles.itemCardapioAcoes}>
                            <TouchableOpacity onPress={() => iniciarEdicaoItem(item)}>
                              <Text style={styles.itemCardapioAcaoTexto}>✏️</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => confirmarExclusaoItem(item)}
                              style={styles.itemCardapioAcaoExcluir}
                            >
                              <Text style={styles.itemCardapioAcaoTexto}>🗑️</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <Text style={styles.subtitulo}>Avaliações</Text>
            </View>
          }
          ListFooterComponent={
            <View style={styles.formulario}>
              {avaliacaoEditandoId === null && avaliacaoDoUsuario ? (
                <View style={styles.avisoJaAvaliou}>
                  <Text style={styles.avisoJaAvaliouTexto}>
                    Você já avaliou este bar. Use ✏️ na sua avaliação acima pra editar, ou 🗑️ pra
                    excluir.
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={styles.subtitulo}>
                    {avaliacaoEditandoId !== null ? 'Editar sua avaliação' : 'Deixe sua avaliação'}
                  </Text>

                  <SeletorDeNota notaSelecionada={nota} onSelecionar={setNota} />

                  <TextInput
                    style={styles.input}
                    placeholder="Escreva um comentário (opcional)"
                    placeholderTextColor="#9ca3af"
                    value={comentario}
                    onChangeText={setComentario}
                    multiline
                  />

                  <TouchableOpacity style={styles.btnEnviar} onPress={enviarAvaliacao}>
                    <Text style={styles.btnEnviarTexto}>
                      {avaliacaoEditandoId !== null ? 'Salvar edição' : 'Enviar avaliação'}
                    </Text>
                  </TouchableOpacity>

                  {avaliacaoEditandoId !== null && (
                    <TouchableOpacity style={styles.btnCancelarEdicao} onPress={cancelarEdicao}>
                      <Text style={styles.btnCancelarEdicaoTexto}>Cancelar</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#1a1a2e',
  },
  btnVoltarTexto: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  conteudo: {
    flex: 1,
  },
  foto: {
    width: '100%',
    height: 200,
  },
  infoBar: {
    padding: 16,
    backgroundColor: '#fff',
  },
  nomeBar: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: 4,
  },
  enderecoBar: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  notaMedia: {
    fontSize: 15,
    color: '#333',
    fontWeight: '600',
  },
  avisoSemMapa: {
    fontSize: 13,
    color: '#7a5d00',
    backgroundColor: '#fff4d6',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  btnAdicionarAoMapa: {
    backgroundColor: '#2e86de',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  btnAdicionarAoMapaTexto: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  btnDesabilitado: {
    opacity: 0.6,
  },
  subtitulo: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a2e',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  secaoDetalhes: {
    backgroundColor: '#fff',
    marginTop: 8,
  },
  textoDetalhes: {
    fontSize: 14,
    lineHeight: 20,
    color: '#444',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  cardapioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 16,
  },
  btnAdicionarItemCardapio: {
    backgroundColor: '#6c63ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  btnAdicionarItemCardapioTexto: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  cardapioVazio: {
    fontSize: 13,
    color: '#888',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  cardapioLista: {
    paddingHorizontal: 16,
  },
  itemCardapio: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 10,
    marginBottom: 10,
  },
  fotoItemCardapio: {
    width: 52,
    height: 52,
    borderRadius: 8,
  },
  fotoItemCardapioPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fotoItemCardapioPlaceholderTexto: {
    fontSize: 22,
  },
  infoItemCardapio: {
    flex: 1,
    marginLeft: 12,
  },
  nomeItemCardapio: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: 2,
  },
  notaItemCardapio: {
    fontSize: 12,
    color: '#888',
  },
  valorItemCardapio: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#27ae60',
    marginLeft: 8,
  },
  itemCardapioAcoes: {
    flexDirection: 'row',
    marginLeft: 12,
  },
  itemCardapioAcaoExcluir: {
    marginLeft: 10,
  },
  itemCardapioAcaoTexto: {
    fontSize: 15,
  },
  itemAvaliacao: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  itemTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemNota: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  itemAcoes: {
    flexDirection: 'row',
  },
  itemAcaoExcluir: {
    marginLeft: 12,
  },
  itemAcaoTexto: {
    fontSize: 15,
  },
  itemComentario: {
    fontSize: 14,
    color: '#444',
  },
  itemRodape: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  itemAutor: {
    fontSize: 12,
    color: '#888',
  },
  itemData: {
    fontSize: 11,
    color: '#aaa',
  },
  itemVerHistorico: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6c63ff',
    marginTop: 8,
  },
  historico: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  historicoItem: {
    marginBottom: 8,
  },
  historicoNota: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#888',
  },
  historicoComentario: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
  },
  historicoData: {
    fontSize: 11,
    color: '#aaa',
    marginTop: 2,
  },
  formulario: {
    padding: 16,
    marginTop: 8,
  },
  avisoJaAvaliou: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 14,
    marginBottom: 24,
  },
  avisoJaAvaliouTexto: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  btnCancelarEdicao: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 4,
    marginBottom: 16,
  },
  btnCancelarEdicaoTexto: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  seletorNota: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  estrelaBotao: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6c63ff',
    marginRight: 8,
    marginBottom: 8,
  },
  estrelaBotaoSelecionada: {
    backgroundColor: '#6c63ff',
  },
  estrelaTexto: {
    color: '#1a1a2e',
    fontWeight: '600',
  },
  estrelaTextoSelecionada: {
    color: '#fff',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    fontSize: 15,
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  btnEnviar: {
    backgroundColor: '#27ae60',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 24,
  },
  btnEnviarTexto: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
