import { useEffect, useState } from 'react';
import { Formulario, Campo, Botao, Aviso } from '../components/Formulario';
import { loginFirebase, loginLocal, biometricCandidate, recoverPassword, friendlyAuthError } from '../services/authService';

export default function TelaLogin({ onEntrar, onAbrirCadastro, onEntrarComBiometria, onConsultar }) {
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [local, setLocal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [candidate, setCandidate] = useState(null);
  useEffect(() => { biometricCandidate().then(setCandidate).catch(() => {}); }, []);
  async function enter() {
    if (busy) return;
    setBusy(true); setError('');
    try { const user = local ? await loginLocal(identity, password) : await loginFirebase(identity, password); setPassword(''); onEntrar(user); }
    catch (e) { setError(friendlyAuthError(e)); } finally { setBusy(false); }
  }
  async function recover() {
    setBusy(true); setError('');
    try { await recoverPassword(identity); setError('Se houver conta para este e-mail, enviaremos as instruções.'); }
    catch (e) { setError(friendlyAuthError(e)); } finally { setBusy(false); }
  }
  return <Formulario title="Bem-vindo ao BotecoRate! 🍻">
    <Aviso>{local ? 'A conta local permite consultar bares e endereços sem internet.' : 'Entre com e-mail e senha. Para avaliar ou gerenciar bares, verifique seu e-mail.'}</Aviso>
    <Campo label={local ? 'Usuário local' : 'E-mail'} value={identity} onChangeText={setIdentity} keyboardType={local ? 'default' : 'email-address'} />
    <Campo label="Senha" value={password} onChangeText={setPassword} secureTextEntry />
    {!!error && <Aviso>{error}</Aviso>}
    <Botao disabled={busy} onPress={enter}>{busy ? 'Aguarde...' : 'Entrar'}</Botao>
    <Botao secondary disabled={busy} onPress={() => { setLocal(!local); setError(''); }}>{local ? 'Usar conta com e-mail' : 'Usar conta local offline'}</Botao>
    {!local && <Botao secondary disabled={busy || !identity.trim()} onPress={recover}>Esqueci minha senha</Botao>}
    {candidate && <Botao secondary disabled={busy} onPress={() => onEntrarComBiometria(candidate)}>Entrar com biometria como {candidate.usuario}</Botao>}
    <Botao secondary disabled={busy} onPress={onAbrirCadastro}>Criar conta</Botao>
    <Botao secondary disabled={busy} onPress={onConsultar}>Consultar bares sem entrar</Botao>
  </Formulario>;
}
