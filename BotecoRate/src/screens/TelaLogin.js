import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { carregarUsuarios, carregarSessao, salvarSessao } from '../services/authStorage';

export default function TelaLogin({ onEntrar, onAbrirCadastro, onEntrarComBiometria }) {
  const [usuarios, setUsuarios] = useState([]);
  // Conta que logou por último neste aparelho — é a que a biometria destrava.
  const [usuarioDaSessao, setUsuarioDaSessao] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    carregarDadosDeAcesso();
  }, []);

  async function carregarDadosDeAcesso() {
    const usuariosSalvos = await carregarUsuarios();
    const sessao = await carregarSessao();

    setUsuarios(usuariosSalvos);

    if (sessao !== null) {
      const daSessao = usuariosSalvos.find((u) => u.id === sessao.usuarioId);
      setUsuarioDaSessao(daSessao !== undefined ? daSessao : null);
    }

    setCarregando(false);
  }

  async function fazerLogin() {
    if (usuarios.length === 0) {
      setErro('Nenhuma conta cadastrada ainda. Crie uma conta primeiro.');
      return;
    }

    const encontrado = usuarios.find(
      (u) => u.usuario.toLowerCase() === usuario.trim().toLowerCase() && u.senha === senha
    );

    if (encontrado === undefined) {
      setErro('Usuário ou senha inválidos.');
      return;
    }

    setErro('');
    await salvarSessao(encontrado.id);
    onEntrar(encontrado);
  }

  if (carregando) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6c63ff" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="light" />

      <KeyboardAvoidingView
        style={styles.conteudo}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.formulario}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.titulo}>Bem-vindo! 🍻</Text>
          <Text style={styles.subtitulo}>Entre para avaliar os botecos da região.</Text>

          <Text style={styles.label}>Usuário</Text>
          <TextInput
            style={styles.input}
            placeholder="Seu usuário"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            value={usuario}
            onChangeText={setUsuario}
          />

          <Text style={styles.label}>Senha</Text>
          <TextInput
            style={styles.input}
            placeholder="Sua senha"
            placeholderTextColor="#9ca3af"
            secureTextEntry
            value={senha}
            onChangeText={setSenha}
          />

          {erro !== '' && <Text style={styles.erro}>{erro}</Text>}

          <TouchableOpacity style={styles.btnEntrar} onPress={fazerLogin}>
            <Text style={styles.btnEntrarTexto}>Entrar</Text>
          </TouchableOpacity>

          {usuarioDaSessao !== null && (
            <TouchableOpacity
              style={styles.btnBiometria}
              onPress={() => onEntrarComBiometria(usuarioDaSessao)}
            >
              <Text style={styles.btnBiometriaTexto}>
                👆 Entrar como {usuarioDaSessao.usuario}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.btnCadastro} onPress={onAbrirCadastro}>
            <Text style={styles.btnCadastroTexto}>Não tem conta? Criar conta</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a2e',
  },
  conteudo: {
    flex: 1,
  },
  formulario: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  titulo: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 6,
  },
  subtitulo: {
    fontSize: 15,
    color: '#c7c7d1',
    marginBottom: 32,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
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
  erro: {
    color: '#ff6b6b',
    fontSize: 14,
    marginBottom: 12,
  },
  btnEntrar: {
    backgroundColor: '#6c63ff',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  btnEntrarTexto: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  btnBiometria: {
    borderWidth: 1,
    borderColor: '#6c63ff',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  btnBiometriaTexto: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  btnCadastro: {
    alignItems: 'center',
    marginTop: 24,
  },
  btnCadastroTexto: {
    color: '#c7c7d1',
    fontSize: 14,
  },
});
