import { usePreventRemove } from '@react-navigation/native';
import { Alert } from 'react-native';

export function useUnsavedChanges(dirty, navigation) {
  usePreventRemove(dirty, ({ data }) => {
    Alert.alert('Descartar alterações?', 'Há informações que ainda não foram salvas.', [
      { text: 'Continuar editando', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });
}
