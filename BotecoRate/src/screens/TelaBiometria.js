import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

export default function TelaBiometria({ onLogout }) {
  const [access, setAccess] = useState(false);

  useEffect(() => {
    (async () => {
      const authentication = await LocalAuthentication.authenticateAsync();
      if (authentication.success)
        setAccess(true)
      else
        setAccess(false)
    })();
  }, []);

  return (
    <View style={styles.container}>
      {access ? (
        <>
          <Text style={styles.successText}>Usuário logado com sucesso!</Text>
          <TouchableOpacity style={[styles.btn, styles.btnLogout]} onPress={onLogout}>
            <Text style={styles.btnText}>Sair</Text>
          </TouchableOpacity>
        </>
      ) : (
        <Text style={styles.subtitle}>Aguardando autenticação biométrica...</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  subtitle: {
    fontSize: 16,
    color: '#555',
    marginBottom: 32,
  },
  successText: {
    fontSize: 18,
    color: '#28a745',
    marginBottom: 24,
  },
  btn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  btnLogout: {
    backgroundColor: '#e74c3c',
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
