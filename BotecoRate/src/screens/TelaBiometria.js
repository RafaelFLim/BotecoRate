import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

export default function TelaBiometria({ onEntrar }) {
  const [access, setAccess] = useState(false);
  const [falhou, setFalhou] = useState(false);

  async function autenticar() {
    setFalhou(false);
    const authentication = await LocalAuthentication.authenticateAsync();
    if (authentication.success)
      setAccess(true)
    else
      setFalhou(true)
  }

  useEffect(() => {
    autenticar();
  }, []);

  return (
    <View style={styles.container}>
      {access ? (
        <>
          <Text style={styles.successText}>Usuário logado com sucesso!</Text>
          <TouchableOpacity style={[styles.btn, styles.btnAcao]} onPress={onEntrar}>
            <Text style={styles.btnText}>Entrar no BotecoRate</Text>
          </TouchableOpacity>
        </>
      ) : falhou ? (
        <>
          <Text style={styles.subtitle}>Não foi possível validar a biometria.</Text>
          <TouchableOpacity style={[styles.btn, styles.btnAcao]} onPress={autenticar}>
            <Text style={styles.btnText}>Tentar novamente</Text>
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
  btnAcao: {
    backgroundColor: '#6c63ff',
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
