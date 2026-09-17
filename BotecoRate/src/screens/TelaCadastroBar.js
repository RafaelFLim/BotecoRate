import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import * as Location from 'expo-location';
import { carregarBares, salvarBares } from '../services/storage';
import { baresIniciais } from '../data/mockBares';
import TelaCamera from './TelaCamera';

// Monta algo como "Rua das Flores, 123 - Centro - São Paulo" com o que o
// reverseGeocodeAsync conseguir devolver (nem todo campo vem preenchido).
function montarEndereco(endereco) {
  const rua = endereco.street ? endereco.street : endereco.name;
  const numero = endereco.streetNumber ? `, ${endereco.streetNumber}` : '';
  const bairro = endereco.district ? ` - ${endereco.district}` : '';
  const cidade = endereco.city ? ` - ${endereco.city}` : '';

  return `${rua ? rua : ''}${numero}${bairro}${cidade}`.trim();
}

export default function TelaCadastroBar({ onVoltar, onCadastrar }) {
  const [localizacao, setLocalizacao] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [carregandoLocalizacao, setCarregandoLocalizacao] = useState(true);
  const [cadastrarSemLocalizacao, setCadastrarSemLocalizacao] = useState(false);

  const [mostrandoCamera, setMostrandoCamera] = useState(false);
  const [nome, setNome] = useState('');
  const [endereco, setEndereco] = useState('');
  const [foto, setFoto] = useState(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    obterLocalizacao();
  }, []);

  async function obterLocalizacao() {
    setErrorMsg(null);
    setCarregandoLocalizacao(true);

    // O try/catch é o que impede a tela de ficar presa em "Obtendo sua localização...":
    // com o GPS desligado, getCurrentPositionAsync lança erro e o setCarregandoLocalizacao(false)
    // do fim nunca seria executado.
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permissão da localização negada!');
        setCarregandoLocalizacao(false);
        return;
      }

      // Ter permissão não significa que o GPS está ligado — são coisas diferentes.
      const servicosLigados = await Location.hasServicesEnabledAsync();
      if (!servicosLigados) {
        setErrorMsg('A localização do aparelho está desligada.');
        setCarregandoLocalizacao(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setLocalizacao(location.coords);

      // O endereço já vem preenchido pela localização atual (o usuário pode editar).
      // Isso depende de internet, então uma falha aqui não pode travar o cadastro.
      try {
        const enderecos = await Location.reverseGeocodeAsync(location.coords);

        if (enderecos.length > 0) {
          setEndereco(montarEndereco(enderecos[0]));
        }
      } catch (error) {
        console.log('Não foi possível descobrir o endereço:', error);
      }

      setCarregandoLocalizacao(false);
    } catch (error) {
      console.log('Erro ao obter a localização:', error);
      setErrorMsg('Não foi possível obter sua localização.');
      setCarregandoLocalizacao(false);
    }
  }

  async function salvarNovoBar() {
    if (!nome.trim() || !endereco.trim()) {
      Alert.alert('Atenção', 'Preencha o nome e o endereço do bar.');
      return;
    }

    if (!foto) {
      Alert.alert('Atenção', 'Tire uma foto do bar antes de salvar.');
      return;
    }

    setSalvando(true);

    const novoBar = {
      id: Date.now().toString(),
      nome: nome.trim(),
      endereco: endereco.trim(),
      foto,
      // Sem GPS o bar é salvo sem coordenada: ele existe na lista, mas não no mapa.
      latitude: localizacao !== null ? localizacao.latitude : null,
      longitude: localizacao !== null ? localizacao.longitude : null,
      avaliacoes: [],
    };

    const dadosSalvos = await carregarBares();
    const listaAtual = dadosSalvos !== null ? dadosSalvos : baresIniciais;
    await salvarBares([...listaAtual, novoBar]);

    setSalvando(false);
    onCadastrar();
  }

  if (mostrandoCamera) {
    return (
      <TelaCamera
        onVoltar={() => setMostrandoCamera(false)}
        onFotoCapturada={(uri) => {
          setFoto(uri);
          setMostrandoCamera(false);
        }}
      />
    );
  }

  if (carregandoLocalizacao) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6c63ff" />
        <Text style={styles.loadingText}>Obtendo sua localização...</Text>
      </View>
    );
  }

  if (errorMsg && !cadastrarSemLocalizacao) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>{errorMsg}</Text>
        <Text style={styles.errorSubtexto}>
          Usamos sua localização para preencher o endereço automaticamente e para posicionar o bar
          no mapa. Ligue o GPS e tente de novo, ou siga sem ela digitando o endereço na mão — nesse
          caso o bar entra na lista, mas não aparece no mapa.
        </Text>
        <TouchableOpacity style={styles.btnTentarNovamente} onPress={obterLocalizacao}>
          <Text style={styles.btnVoltarErroTexto}>Tentar novamente</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btnSemLocalizacao}
          onPress={() => setCadastrarSemLocalizacao(true)}
        >
          <Text style={styles.btnVoltarErroTexto}>Cadastrar sem localização</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnVoltarErro} onPress={onVoltar}>
          <Text style={styles.btnVoltarErroTexto}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onVoltar}>
          <Text style={styles.btnVoltarTexto}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.titulo}>Novo bar</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.conteudo}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.formulario}
          keyboardShouldPersistTaps="handled"
        >
          {localizacao === null && (
            <View style={styles.avisoSemLocalizacao}>
              <Text style={styles.avisoSemLocalizacaoTexto}>
                ⚠️ Sem localização: digite o endereço à mão. Este bar não vai aparecer no mapa.
              </Text>
            </View>
          )}

          <TouchableOpacity style={styles.areaFoto} onPress={() => setMostrandoCamera(true)}>
            {foto ? (
              <Image source={{ uri: foto }} style={styles.fotoPreview} />
            ) : (
              <Text style={styles.areaFotoTexto}>📷 Tirar foto do bar</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.label}>Nome</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Boteco do Zé"
            placeholderTextColor="#9ca3af"
            value={nome}
            onChangeText={setNome}
          />

          <Text style={styles.label}>Endereço</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Rua das Flores, 123 - Centro"
            placeholderTextColor="#9ca3af"
            value={endereco}
            onChangeText={setEndereco}
          />
          {localizacao !== null && (
            <Text style={styles.ajudaEndereco}>
              📍 Preenchido pela sua localização atual, que também vira o pin do bar no mapa.
              Confira e edite se precisar.
            </Text>
          )}

          <TouchableOpacity
            style={[styles.btnSalvar, salvando && styles.btnSalvarDesabilitado]}
            onPress={salvarNovoBar}
            disabled={salvando}
          >
            <Text style={styles.btnSalvarTexto}>
              {salvando ? 'Salvando...' : 'Salvar bar'}
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#333',
  },
  errorText: {
    fontSize: 16,
    color: 'red',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorSubtexto: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  avisoSemLocalizacao: {
    backgroundColor: '#fff4d6',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f0c674',
    padding: 12,
    marginBottom: 16,
  },
  avisoSemLocalizacaoTexto: {
    fontSize: 13,
    color: '#7a5d00',
  },
  btnSemLocalizacao: {
    backgroundColor: '#f39c12',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  btnTentarNovamente: {
    backgroundColor: '#6c63ff',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  btnVoltarErro: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  btnVoltarErroTexto: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
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
  areaFoto: {
    height: 180,
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
    fontSize: 15,
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
  ajudaEndereco: {
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
    marginBottom: 24,
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
