import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useEffect, useState } from 'react';
import TelaBiometria from './TelaBiometria';
import TelaMapaGPS from './TelaMapaGPS';
import TelaCamera from './TelaCamera';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// ─── Menu principal ───────────────────────────────────────────────────────────
function MenuPrincipal({ biometria, onBiometria, onMapa, onCamera }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>BotecoRate</Text>
      <Text style={styles.subtitle}>Escolha uma funcionalidade:</Text>

      <TouchableOpacity style={[styles.btn, styles.btnBio]} onPress={onBiometria}>
        <Text style={styles.btnText}>
          {biometria ? '🔐 Biometria' : '⚠️ Biometria (indisponível)'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.btn, styles.btnMapa]} onPress={onMapa}>
        <Text style={styles.btnText}>🗺️ Mapa & GPS</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.btn, styles.btnCamera]} onPress={onCamera}>
        <Text style={styles.btnText}>📷 Câmera</Text>
      </TouchableOpacity>

      <StatusBar style="auto" />
    </View>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [biometria, setBiometria] = useState(false);
  // 'menu' | 'biometria' | 'mapa' | 'camera'
  const [tela, setTela] = useState('menu');

  useEffect(() => {
    (async () => {
      const compativel = await LocalAuthentication.hasHardwareAsync();
      setBiometria(compativel);
    })();
  }, []);

  if (tela === 'biometria') {
    return <TelaBiometria onLogout={() => setTela('menu')} />;
  }

  if (tela === 'mapa') {
    return <TelaMapaGPS onVoltar={() => setTela('menu')} />;
  }

  if (tela === 'camera') {
    return (
      <SafeAreaProvider>
        <TelaCamera onVoltar={() => setTela('menu')} />
      </SafeAreaProvider>
    );
  }

  return (
    <MenuPrincipal
      biometria={biometria}
      onBiometria={() => setTela('biometria')}
      onMapa={() => setTela('mapa')}
      onCamera={() => setTela('camera')}
    />
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
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: 8,
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
  btnBio: {
    backgroundColor: '#6c63ff',
  },
  btnMapa: {
    backgroundColor: '#2e86de',
  },
  btnCamera: {
    backgroundColor: '#27ae60',
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
