import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@boteco_rate_bares';

export async function carregarBares() {
  try {
    const dadosSalvos = await AsyncStorage.getItem(STORAGE_KEY);

    if (dadosSalvos !== null) {
      return JSON.parse(dadosSalvos);
    }

    return null;
  } catch (error) {
    console.log('Erro ao carregar bares:', error);
    return null;
  }
}

export async function salvarBares(listaDeBares) {
  try {
    const dados = JSON.stringify(listaDeBares);
    await AsyncStorage.setItem(STORAGE_KEY, dados);
  } catch (error) {
    console.log('Erro ao salvar bares:', error);
  }
}
