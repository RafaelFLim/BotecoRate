import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useEffect, useState } from 'react';

export function TelaSegura({ onLogout }) {
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
    <View>
      {access && (
        <Text>Usuário logado com sucesso!</Text>
      )}
      <TouchableOpacity onPress={onLogout}><Text>Sair</Text></TouchableOpacity>
    </View>
  )

}

export default function App() {

  const [biometria, setBiometria] = useState(false);
  const [render, setRender] = useState(false);

  const changeRender = () => setRender(true)
  const logout = () => setRender(false)

  useEffect(() => {
    (async () => {
      const compativel = await LocalAuthentication.hasHardwareAsync();
      setBiometria(compativel);
    })();
  }, []);

  if (render) {
    return (
      <TelaSegura onLogout={logout} />
    )
  } else {
    return (
      <View style={styles.container}>
        <Text>
          {biometria
            ? 'Faça o login com biometria'
            : 'Dispositivo não compatível com biometria'
          }
        </Text>
        <TouchableOpacity onPress={changeRender}><Text>Logar</Text></TouchableOpacity>
        <StatusBar style="auto" />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
