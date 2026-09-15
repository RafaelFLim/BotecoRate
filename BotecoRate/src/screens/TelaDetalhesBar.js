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

function ItemAvaliacao({ avaliacao }) {
  return (
    <View style={styles.itemAvaliacao}>
      <Text style={styles.itemNota}>⭐ {avaliacao.nota}</Text>
      <Text style={styles.itemComentario}>{avaliacao.comentario}</Text>
    </View>
  );
}

export default function TelaDetalhesBar({ bar, onVoltar, onAvaliar }) {
  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState('');

  const notaMedia = calcularNotaMedia(bar.avaliacoes);

  function enviarAvaliacao() {
    if (nota === 0) {
      Alert.alert('Atenção', 'Selecione uma nota de 1 a 5 estrelas.');
      return;
    }

    const novaAvaliacao = {
      id: Date.now().toString(),
      nota,
      comentario: comentario.trim() || 'Sem comentário.',
    };

    onAvaliar(bar.id, novaAvaliacao);
    setNota(0);
    setComentario('');
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
          renderItem={({ item }) => <ItemAvaliacao avaliacao={item} />}
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
              </View>

              <Text style={styles.subtitulo}>Avaliações</Text>
            </View>
          }
          ListFooterComponent={
            <View style={styles.formulario}>
              <Text style={styles.subtitulo}>Deixe sua avaliação</Text>

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
                <Text style={styles.btnEnviarTexto}>Enviar avaliação</Text>
              </TouchableOpacity>
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
  itemNota: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: 4,
  },
  itemComentario: {
    fontSize: 14,
    color: '#444',
  },
  formulario: {
    padding: 16,
    marginTop: 8,
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
