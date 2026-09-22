import { useState } from 'react';
import TelaLogin from './src/screens/TelaLogin';
import TelaCadastroUsuario from './src/screens/TelaCadastroUsuario';
import TelaBiometria from './src/screens/TelaBiometria';
import TelaListagemBares from './src/screens/TelaListagemBares';
import TelaMapaGPS from './src/screens/TelaMapaGPS';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// ─── App root ─────────────────────────────────────────────────────────────────
export default function App() {
  // 'login' | 'cadastroUsuario' | 'biometria' | 'lista' | 'mapa'
  const [tela, setTela] = useState('login');
  // Conta que está usando o app agora — usada como autor das avaliações.
  const [usuarioLogado, setUsuarioLogado] = useState(null);
  // Aviso rápido mostrado sobre a lista logo depois do login (some sozinho).
  const [mensagemBoasVindas, setMensagemBoasVindas] = useState(null);

  function sair() {
    setUsuarioLogado(null);
    setTela('login');
  }

  // Mantém o objeto usuarioLogado em dia depois que a Tela de Perfil troca a senha,
  // pra não ficar com uma senha antiga em cache aqui em cima.
  function atualizarSenhaUsuarioLogado(novaSenha) {
    setUsuarioLogado((atual) => ({ ...atual, senha: novaSenha }));
  }

  return (
    <SafeAreaProvider>
      {tela === 'mapa' && <TelaMapaGPS onVoltar={() => setTela('lista')} />}

      {tela === 'lista' && (
        <TelaListagemBares
          usuarioLogado={usuarioLogado}
          mensagemBoasVindas={mensagemBoasVindas}
          onFecharBoasVindas={() => setMensagemBoasVindas(null)}
          onAbrirMapa={() => setTela('mapa')}
          onSair={sair}
          onSenhaAlterada={atualizarSenhaUsuarioLogado}
        />
      )}

      {tela === 'biometria' && (
        <TelaBiometria
          onEntrar={() => {
            setMensagemBoasVindas(`Bem-vindo de volta, ${usuarioLogado.usuario}! 🍻`);
            setTela('lista');
          }}
          onVoltar={sair}
        />
      )}

      {tela === 'cadastroUsuario' && (
        <TelaCadastroUsuario
          onVoltar={() => setTela('login')}
          onCadastrar={() => setTela('login')}
        />
      )}

      {tela === 'login' && (
        <TelaLogin
          onEntrar={(usuario) => {
            setUsuarioLogado(usuario);
            setMensagemBoasVindas(`Bem-vindo, ${usuario.usuario}! 🍻`);
            setTela('lista');
          }}
          onAbrirCadastro={() => setTela('cadastroUsuario')}
          onEntrarComBiometria={(usuario) => {
            setUsuarioLogado(usuario);
            setTela('biometria');
          }}
        />
      )}
    </SafeAreaProvider>
  );
}
