import { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import TelaCamera from './TelaCamera';

// Formulário de um item de cardápio: cria um item novo num bar que já existe,
// ou edita um item que já existe (itemExistente preenchido) — só o dono do bar
// chega aqui, a trava é feita em TelaDetalhesBar. onSalvar só devolve os campos
// editáveis; quem decide se é criação ou edição (e cuida do histórico) é quem
// chamou essa tela.
export default function TelaFormularioItem({ itemExistente, onVoltar, onSalvar }) {
  const [capturandoFoto, setCapturandoFoto] = useState(false);
  const [tipo, setTipo] = useState(itemExistente ? itemExistente.tipo : 'comida');
  const [nome, setNome] = useState(itemExistente ? itemExistente.nome : '');
  const [descricao, setDescricao] = useState(itemExistente ? itemExistente.descricao : '');
  const [valor, setValor] = useState(
    itemExistente ? String(itemExistente.valor).replace('.', ',') : ''
  );
  const [foto, setFoto] = useState(itemExistente ? itemExistente.foto : null);

  function salvar() {
    if (!nome.trim()) {
      Alert.alert('Atenção', 'Digite o nome do item.');
      return;
    }

    const valorNumerico = Number(valor.replace(',', '.'));

    if (!valor.trim() || Number.isNaN(valorNumerico) || valorNumerico <= 0) {
      Alert.alert('Atenção', 'Digite um valor válido pro item.');
      return;
    }

    if (!descricao.trim()) {
      Alert.alert('Atenção', 'Digite os detalhes do item (ingredientes, tamanho...).');
      return;
    }

    onSalvar({
      tipo,
      nome: nome.trim(),
      descricao: descricao.trim(),
      valor: valorNumerico,
      foto,
    });
  }

  if (capturandoFoto) {
    return (
      <TelaCamera
        onVoltar={() => setCapturandoFoto(false)}
        onFotoCapturada={(uri) => {
          setFoto(uri);
          setCapturandoFoto(false);
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onVoltar}>
          <Text style={styles.btnVoltarTexto}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.titulo}>{itemExistente ? 'Editar item' : 'Novo item do cardápio'}</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.conteudo}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.formulario} keyboardShouldPersistTaps="handled">
          <View style={styles.seletorTipo}>
            <TouchableOpacity
              style={[styles.btnTipo, tipo === 'comida' && styles.btnTipoSelecionado]}
              onPress={() => setTipo('comida')}
            >
              <Text
                style={[styles.btnTipoTexto, tipo === 'comida' && styles.btnTipoTextoSelecionado]}
              >
                🍢 Comida
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnTipo, tipo === 'bebida' && styles.btnTipoSelecionado]}
              onPress={() => setTipo('bebida')}
            >
              <Text
                style={[styles.btnTipoTexto, tipo === 'bebida' && styles.btnTipoTextoSelecionado]}
              >
                🍺 Bebida
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.areaFoto} onPress={() => setCapturandoFoto(true)}>
            {foto ? (
              <Image source={{ uri: foto }} style={styles.fotoPreview} />
            ) : (
              <Text style={styles.areaFotoTexto}>📷 Foto do item (opcional)</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.label}>Nome</Text>
          <TextInput
            style={styles.input}
            placeholder="Nome do item"
            placeholderTextColor="#9ca3af"
            value={nome}
            onChangeText={setNome}
          />

          <Text style={styles.label}>Detalhes</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Ingredientes, tamanho..."
            placeholderTextColor="#9ca3af"
            value={descricao}
            onChangeText={setDescricao}
            multiline
          />

          <Text style={styles.label}>Valor (R$)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: 15,00"
            placeholderTextColor="#9ca3af"
            value={valor}
            onChangeText={setValor}
            keyboardType="decimal-pad"
          />

          <TouchableOpacity style={styles.btnSalvar} onPress={salvar}>
            <Text style={styles.btnSalvarTexto}>Adicionar ao cardápio</Text>
          </TouchableOpacity>
        </ScrollView>
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
  titulo: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  conteudo: {
    flex: 1,
  },
  formulario: {
    padding: 16,
  },
  seletorTipo: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  btnTipo: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6c63ff',
    alignItems: 'center',
    marginRight: 8,
  },
  btnTipoSelecionado: {
    backgroundColor: '#6c63ff',
  },
  btnTipoTexto: {
    color: '#1a1a2e',
    fontWeight: '600',
    fontSize: 13,
  },
  btnTipoTextoSelecionado: {
    color: '#fff',
  },
  areaFoto: {
    height: 140,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    overflow: 'hidden',
  },
  areaFotoTexto: {
    fontSize: 14,
    color: '#6c63ff',
    fontWeight: '600',
  },
  fotoPreview: {
    width: '100%',
    height: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    fontSize: 15,
    marginBottom: 16,
  },
  textarea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  btnSalvar: {
    backgroundColor: '#27ae60',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  btnSalvarTexto: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
