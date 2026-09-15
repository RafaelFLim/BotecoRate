import { useState } from 'react';
import TelaBiometria from './src/screens/TelaBiometria';
import TelaListagemBares from './src/screens/TelaListagemBares';
import TelaMapaGPS from './src/screens/TelaMapaGPS';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// ─── App root ─────────────────────────────────────────────────────────────────
export default function App() {
  // 'biometria' | 'lista' | 'mapa'
  const [tela, setTela] = useState('biometria');

  if (tela === 'mapa') {
    return <TelaMapaGPS onVoltar={() => setTela('lista')} />;
  }

  if (tela === 'lista') {
    return (
      <SafeAreaProvider>
        <TelaListagemBares onAbrirMapa={() => setTela('mapa')} />
      </SafeAreaProvider>
    );
  }

  return <TelaBiometria onEntrar={() => setTela('lista')} />;
}
