import AsyncStorage from '@react-native-async-storage/async-storage';

const USUARIOS_KEY = '@boteco_rate_usuarios';
const SESSAO_KEY = '@boteco_rate_sessao';

// Mesmo padrão do storage.js dos bares: o service só lê e grava a lista inteira,
// quem manipula os dados é a tela. A senha fica em texto puro porque é um trabalho
// acadêmico — em um app real ela seria salva como hash.
export async function carregarUsuarios() {
  try {
    const dadosSalvos = await AsyncStorage.getItem(USUARIOS_KEY);

    if (dadosSalvos !== null) {
      return JSON.parse(dadosSalvos);
    }

    return [];
  } catch (error) {
    console.log('Erro ao carregar usuários:', error);
    return [];
  }
}

export async function salvarUsuarios(listaDeUsuarios) {
  try {
    const dados = JSON.stringify(listaDeUsuarios);
    await AsyncStorage.setItem(USUARIOS_KEY, dados);
  } catch (error) {
    console.log('Erro ao salvar usuários:', error);
  }
}

// A sessão guarda o id da última conta que logou NESTE aparelho. É essa conta —
// e só ela — que o atalho da biometria destrava.
export async function carregarSessao() {
  try {
    const dadosSalvos = await AsyncStorage.getItem(SESSAO_KEY);

    if (dadosSalvos !== null) {
      return JSON.parse(dadosSalvos);
    }

    return null;
  } catch (error) {
    console.log('Erro ao carregar sessão:', error);
    return null;
  }
}

export async function salvarSessao(usuarioId) {
  try {
    const dados = JSON.stringify({ usuarioId });
    await AsyncStorage.setItem(SESSAO_KEY, dados);
  } catch (error) {
    console.log('Erro ao salvar sessão:', error);
  }
}
