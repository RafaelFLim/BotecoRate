import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { unlockPersistedSession, friendlyAuthError } from '../services/authService';
import MensagemErro from '../components/MensagemErro';

export default function TelaBiometria({ accountId, onEntrar, onVoltar }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const mounted = useRef(false);
  const inFlight = useRef(false);
  const controller = useRef(null);

  async function autenticar() {
    if (inFlight.current) return;
    inFlight.current = true;
    controller.current = new AbortController();
    setError(''); setBusy(true);
    try {
      await unlockPersistedSession(accountId, {signal:controller.current.signal});
      if (mounted.current) onEntrar();
    } catch (e) { if (mounted.current) setError(friendlyAuthError(e)); }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }

  useEffect(() => {
    mounted.current = true;
    autenticar();
    return () => {
      mounted.current = false;
      controller.current?.abort();
      if (Platform.OS === 'android' && inFlight.current) LocalAuthentication.cancelAuthenticate().catch(()=>{});
    };
  }, []);

  return (
    <View style={styles.container}>
      {error ? (
        <>
          <MensagemErro>{error}</MensagemErro>
          <TouchableOpacity disabled={busy} style={[styles.btn, styles.btnAcao]} onPress={autenticar}>
            <Text style={styles.btnText}>Tentar novamente</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnVoltar]} onPress={onVoltar}>
            <Text style={styles.btnVoltarText}>Entrar com senha</Text>
          </TouchableOpacity>
        </>
      ) : (
        <><ActivityIndicator color="#6c63ff" size="large"/><Text style={[styles.subtitle,{marginTop:20}]}>Confirme sua identidade para entrar.</Text></>
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
  btnVoltar: {
    backgroundColor: '#e5e7eb',
  },
  btnVoltarText: {
    color: '#333',
    fontSize: 16,
    fontWeight: 'bold',
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
