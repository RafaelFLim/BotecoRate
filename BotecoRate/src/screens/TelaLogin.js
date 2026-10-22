import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Text, View } from 'react-native';
import { Formulario, Campo, Botao, Aviso } from '../components/Formulario';
import { loginFirebase, loginLocal, biometricCandidate, recoverPassword, friendlyAuthError } from '../services/authService';
import { useFocusEffect } from '@react-navigation/native';

export default function TelaLogin({ onEntrar, onAbrirCadastro, onEntrarComBiometria, onConsultar }) {
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [local, setLocal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [candidate, setCandidate] = useState(null);
  const [phase, setPhase] = useState('');
  const entering = useRef(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    setCandidate(null);
    biometricCandidate().then(value=>{if(active)setCandidate(value);}).catch(()=>{if(active)setCandidate(null);});
    return ()=>{active=false;};
  }, []));
  async function enter() {
    if (entering.current || busy) return;
    entering.current = true;
    Keyboard.dismiss();
    setBusy(true); setError('');
    setPhase(local ? 'Preparando sua entrada…' : 'Entrando na sua conta…');
    try { const user = local ? await loginLocal(identity, password, setPhase) : await loginFirebase(identity, password); setPassword(''); onEntrar(user); }
    catch (e) { setError(friendlyAuthError(e)); } finally { entering.current = false; setBusy(false); }
  }
  async function recover() {
    setBusy(true); setError('');
    try { await recoverPassword(identity); setError('Se houver conta para este e-mail, enviaremos as instruções.'); }
    catch (e) { setError(friendlyAuthError(e)); } finally { setBusy(false); }
  }
  return <Formulario title="Bem-vindo ao BotecoRate! 🍻">
    <Aviso>{local ? 'A conta local permite consultar bares e endereços sem internet.' : 'Entre com e-mail e senha. Para avaliar ou gerenciar bares, verifique seu e-mail.'}</Aviso>
    <Campo label={local ? 'Usuário local' : 'E-mail'} value={identity} onChangeText={setIdentity} keyboardType={local ? 'default' : 'email-address'} editable={!busy}/>
    <Campo label="Senha" value={password} onChangeText={setPassword} secureTextEntry editable={!busy}/>
    {!!error && <Aviso>{error}</Aviso>}
    {busy && <View accessibilityLiveRegion="polite" style={{alignItems:'center',gap:8,paddingVertical:12}}><ActivityIndicator color="#6c63ff"/><Text style={{textAlign:'center'}}>{phase}</Text></View>}
    <Botao disabled={busy} onPress={enter}>{busy ? 'Aguarde...' : 'Entrar'}</Botao>
    <Botao secondary disabled={busy} onPress={() => { setLocal(!local); setError(''); }}>{local ? 'Usar conta com e-mail' : 'Usar conta local offline'}</Botao>
    {!local && <Botao secondary disabled={busy || !identity.trim()} onPress={recover}>Esqueci minha senha</Botao>}
    {candidate && <Botao secondary disabled={busy} onPress={() => onEntrarComBiometria(candidate)}>Entrar com biometria como {candidate.usuario}</Botao>}
    <Botao secondary disabled={busy} onPress={onAbrirCadastro}>Criar conta</Botao>
    <Botao secondary disabled={busy} onPress={onConsultar}>Consultar bares sem entrar</Botao>
  </Formulario>;
}
