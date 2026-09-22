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
import { validarSenha } from '../utils/senha';

export default function TelaPerfil({ usuarioLogado, onVoltar, onSenhaAlterada, onSair }) {
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function trocarSenha() {
    if (!senhaAtual.trim() || !novaSenha.trim()) {
      Alert.alert('Atenção', 'Preencha a senha atual e a nova senha.');
      return;
    }

    if (senhaAtual !== usuarioLogado.senha) {
      Alert.alert('Atenção', 'Senha atual incorreta.');
      return;
    }

    const erroSenha = validarSenha(novaSenha);

    if (erroSenha !== null) {
      Alert.alert('Atenção', erroSenha);
      return;
    }

    setSalvando(true);

    const usuariosSalvos = await carregarUsuarios();
    const novaLista = usuariosSalvos.map((u) =>
      u.id === usuarioLogado.id ? { ...u, senha: novaSenha } : u
    );

    await salvarUsuarios(novaLista);
    setSalvando(false);
    setSenhaAtual('');
    setNovaSenha('');

    onSenhaAlterada(novaSenha);
    Alert.alert('Pronto!', 'Senha alterada com sucesso.');
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onVoltar}>
          <Text style={styles.btnVoltarTexto}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.titulo}>Perfil</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.conteudo}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.formulario}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.identidade}>
            <View style={styles.avatar}>
              <Text style={styles.avatarTexto}>
                {usuarioLogado.usuario.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.nomeUsuario}>{usuarioLogado.usuario}</Text>
          </View>

          <Text style={styles.secaoTitulo}>Alterar senha</Text>

          <Text style={styles.label}>Senha atual</Text>
          <TextInput
            style={styles.input}
            placeholder="Digite a senha atual"
            placeholderTextColor="#9ca3af"
            secureTextEntry
            value={senhaAtual}
            onChangeText={setSenhaAtual}
          />

          <Text style={styles.label}>Nova senha</Text>
          <TextInput
            style={styles.input}
            placeholder="Digite a nova senha"
            placeholderTextColor="#9ca3af"
            secureTextEntry
            value={novaSenha}
            onChangeText={setNovaSenha}
          />
          <Text style={styles.ajudaSenha}>
            Mínimo 8 caracteres, com 1 letra maiúscula e 1 caractere especial.
          </Text>

          <TouchableOpacity
            style={[styles.btnSalvar, salvando && styles.btnSalvarDesabilitado]}
            onPress={trocarSenha}
            disabled={salvando}
          >
            <Text style={styles.btnSalvarTexto}>
              {salvando ? 'Salvando...' : 'Salvar nova senha'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnSair} onPress={onSair}>
            <Text style={styles.btnSairTexto}>Sair</Text>
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
  identidade: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 28,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#6c63ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarTexto: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  nomeUsuario: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  secaoTitulo: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 10,
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
  ajudaSenha: {
    fontSize: 12,
    color: '#666',
    marginTop: -8,
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
  btnSair: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 24,
  },
  btnSairTexto: {
    color: '#1a1a2e',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
