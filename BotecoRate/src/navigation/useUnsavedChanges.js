import { usePreventRemove } from '@react-navigation/native';
import { Alert } from 'react-native';

export function useUnsavedChanges(dirty, navigation, { saving = false } = {}) {
  usePreventRemove(dirty || saving, ({ data }) => {
    if (saving) {
      Alert.alert('Só um instante', 'Estamos salvando suas informações. Aguarde a conclusão para sair.');
      return;
    }
    Alert.alert('Descartar alterações?', 'Há informações que ainda não foram salvas.', [
      { text: 'Continuar editando', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });
}
