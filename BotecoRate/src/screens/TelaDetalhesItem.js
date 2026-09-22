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
import { calcularNotaMedia } from '../utils/nota';
import { formatarDataHora } from '../utils/data';

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

// Mesmo cartão de avaliação (com edição/exclusão e histórico) usado na tela
// de detalhes do bar — aqui avaliando um item do cardápio em vez do bar.
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
        <Text style={styles.itemAutor}>
          por {avaliacao.autor ? avaliacao.autor : 'anônimo'}
        </Text>
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

export default function TelaDetalhesItem({
  item,
  usuarioLogado,
  onVoltar,
  onAvaliar,
  onEditarAvaliacao,
  onExcluirAvaliacao,
}) {
  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState('');
  const [avaliacaoEditandoId, setAvaliacaoEditandoId] = useState(null);
  const [historicoItemAberto, setHistoricoItemAberto] = useState(false);

  const notaMedia = calcularNotaMedia(item.avaliacoes);
  const valorFormatado = `R$ ${item.valor.toFixed(2).replace('.', ',')}`;
  const temHistoricoItem = item.historico && item.historico.length > 0;

  // Mesma regra do bar: cada usuário só pode ter uma avaliação por item.
  const avaliacaoDoUsuario = usuarioLogado
    ? item.avaliacoes.find((avaliacao) => avaliacao.autor === usuarioLogado.usuario)
    : null;

  function enviarAvaliacao() {
    if (nota === 0) {
      Alert.alert('Atenção', 'Selecione uma nota de 1 a 5 estrelas.');
      return;
    }

    if (avaliacaoEditandoId !== null) {
      onEditarAvaliacao(item.id, avaliacaoEditandoId, {
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

    onAvaliar(item.id, novaAvaliacao);
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
          onExcluirAvaliacao(item.id, avaliacao.id);

          if (avaliacaoEditandoId === avaliacao.id) {
            cancelarEdicao();
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onVoltar}>
          <Text style={styles.btnVoltarTexto}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.tituloHeader} numberOfLines={1}>
          {item.nome}
        </Text>
      </View>

      <KeyboardAvoidingView
        style={styles.conteudo}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          data={item.avaliacoes}
          keyExtractor={(avaliacao) => avaliacao.id}
          renderItem={({ item: avaliacao }) => (
            <ItemAvaliacao
              avaliacao={avaliacao}
              ehPropria={usuarioLogado !== null && avaliacao.autor === usuarioLogado.usuario}
              onEditar={() => iniciarEdicao(avaliacao)}
              onExcluir={() => confirmarExclusao(avaliacao)}
            />
          )}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View>
              {item.foto ? (
                <Image style={styles.foto} source={{ uri: item.foto }} />
              ) : (
                <View style={styles.fotoPlaceholder}>
                  <Text style={styles.fotoPlaceholderTexto}>
                    {item.tipo === 'bebida' ? '🍺' : '🍢'}
                  </Text>
                </View>
              )}

              <View style={styles.infoItem}>
                <View style={styles.badgeTipo}>
                  <Text style={styles.badgeTipoTexto}>
                    {item.tipo === 'bebida' ? '🍺 Bebida' : '🍢 Comida'}
                  </Text>
                </View>
                <Text style={styles.nomeItem}>{item.nome}</Text>
                <Text style={styles.descricaoItem}>{item.descricao}</Text>
                <Text style={styles.valorItem}>{valorFormatado}</Text>
                <Text style={styles.notaMedia}>
                  ⭐ {notaMedia.toFixed(1)} ({item.avaliacoes.length} avaliações)
                </Text>

                {(item.editadoEm || item.criadoEm) && (
                  <Text style={styles.dataItem}>
                    {item.editadoEm
                      ? `Editado em ${formatarDataHora(item.editadoEm)}`
                      : `Adicionado em ${formatarDataHora(item.criadoEm)}`}
                  </Text>
                )}

                {temHistoricoItem && (
                  <TouchableOpacity onPress={() => setHistoricoItemAberto(!historicoItemAberto)}>
                    <Text style={styles.verHistoricoItem}>
                      {historicoItemAberto
                        ? 'Ocultar histórico de edições do item ▲'
                        : `Ver histórico de edições do item (${item.historico.length}) ▼`}
                    </Text>
                  </TouchableOpacity>
                )}

                {historicoItemAberto && (
                  <View style={styles.historicoItemLista}>
                    {item.historico.map((versao, indice) => (
                      <View key={indice} style={styles.historicoItemVersao}>
                        <Text style={styles.historicoItemVersaoTitulo}>
                          {versao.tipo === 'bebida' ? '🍺' : '🍢'} {versao.nome} — R${' '}
                          {versao.valor.toFixed(2).replace('.', ',')}
                        </Text>
                        <Text style={styles.historicoItemVersaoDescricao}>
                          {versao.descricao}
                        </Text>
                        <Text style={styles.historicoItemVersaoData}>
                          {formatarDataHora(versao.data)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <Text style={styles.subtitulo}>Avaliações</Text>
            </View>
          }
          ListFooterComponent={
            <View style={styles.formulario}>
              {avaliacaoEditandoId === null && avaliacaoDoUsuario ? (
                <View style={styles.avisoJaAvaliou}>
                  <Text style={styles.avisoJaAvaliouTexto}>
                    Você já avaliou este item. Use ✏️ na sua avaliação acima pra editar, ou 🗑️
                    pra excluir.
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#1a1a2e',
  },
  btnVoltarTexto: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 16,
  },
  tituloHeader: {
    flex: 1,
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
  conteudo: {
    flex: 1,
  },
  foto: {
    width: '100%',
    height: 200,
  },
  fotoPlaceholder: {
    width: '100%',
    height: 140,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fotoPlaceholderTexto: {
    fontSize: 48,
  },
  infoItem: {
    padding: 16,
    backgroundColor: '#fff',
  },
  badgeTipo: {
    alignSelf: 'flex-start',
    backgroundColor: '#f3f4f6',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  badgeTipoTexto: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  nomeItem: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: 4,
  },
  descricaoItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  valorItem: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#27ae60',
    marginBottom: 6,
  },
  notaMedia: {
    fontSize: 15,
    color: '#333',
    fontWeight: '600',
  },
  dataItem: {
    fontSize: 12,
    color: '#999',
    marginTop: 6,
  },
  verHistoricoItem: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6c63ff',
    marginTop: 8,
  },
  historicoItemLista: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  historicoItemVersao: {
    marginBottom: 10,
  },
  historicoItemVersaoTitulo: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#888',
  },
  historicoItemVersaoDescricao: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 2,
  },
  historicoItemVersaoData: {
    fontSize: 11,
    color: '#aaa',
    marginTop: 2,
  },
  subtitulo: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a2e',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
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
