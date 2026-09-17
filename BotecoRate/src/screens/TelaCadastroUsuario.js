import { useState } from 'react';
import {
  Alert,
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
import { carregarUsuarios, salvarUsuarios } from '../services/authStorage';

export default function TelaCadastroUsuario({ onVoltar, onCadastrar }) {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvarNovoUsuario() {
    if (!usuario.trim() || !senha.trim()) {
      Alert.alert('Atenção', 'Preencha o usuário e a senha.');
      return;
    }

    if (senha !== confirmarSenha) {
      Alert.alert('Atenção', 'As senhas não são iguais.');
      return;
    }

    setSalvando(true);

    const usuariosSalvos = await carregarUsuarios();
    const nomeEscolhido = usuario.trim();
    const jaExiste = usuariosSalvos.some(
      (u) => u.usuario.toLowerCase() === nomeEscolhido.toLowerCase()
    );

    if (jaExiste) {
      setSalvando(false);
      Alert.alert('Atenção', 'Já existe uma conta com esse usuário.');
      return;
    }

    const novoUsuario = {
      id: Date.now().toString(),
      usuario: nomeEscolhido,
      senha,
    };

    await salvarUsuarios([...usuariosSalvos, novoUsuario]);
    setSalvando(false);

    Alert.alert('Pronto!', 'Conta criada. Faça login para entrar.');
    onCadastrar();
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onVoltar}>
          <Text style={styles.btnVoltarTexto}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.titulo}>Criar conta</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.conteudo}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.formulario}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>Usuário</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: emanuel"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            value={usuario}
            onChangeText={setUsuario}
          />

          <Text style={styles.label}>Senha</Text>
          <TextInput
            style={styles.input}
            placeholder="Digite uma senha"
            placeholderTextColor="#9ca3af"
            secureTextEntry
            value={senha}
            onChangeText={setSenha}
          />

          <Text style={styles.label}>Confirmar senha</Text>
          <TextInput
            style={styles.input}
            placeholder="Digite a senha de novo"
            placeholderTextColor="#9ca3af"
            secureTextEntry
            value={confirmarSenha}
            onChangeText={setConfirmarSenha}
          />

          <TouchableOpacity
            style={[styles.btnSalvar, salvando && styles.btnSalvarDesabilitado]}
            onPress={salvarNovoUsuario}
            disabled={salvando}
          >
            <Text style={styles.btnSalvarTexto}>
              {salvando ? 'Salvando...' : 'Criar conta'}
            </Text>
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
  btnSalvar: {
    backgroundColor: '#27ae60',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  btnSalvarDesabilitado: {
    opacity: 0.6,
  },
  btnSalvarTexto: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
