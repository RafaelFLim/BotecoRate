import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Text, View } from 'react-native';
import { Formulario, Campo, Botao, Aviso } from '../components/Formulario';
import { loginFirebase, loginLocal, biometricCandidate, recoverPassword, friendlyAuthError } from '../services/authService';
import { useFocusEffect } from '@react-navigation/native';

export default function TelaLogin({ accountType, onVoltar, onEntrar, onAbrirCadastro, onEntrarComBiometria, onConsultar }) {
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const local = accountType === 'local';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
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
    setBusy(true); setError(''); setNotice('');
    setPhase(local ? 'Preparando sua entrada…' : 'Entrando na sua conta…');
    try { const user = local ? await loginLocal(identity, password, setPhase) : await loginFirebase(identity, password); setPassword(''); onEntrar(user); }
    catch (e) { setError(friendlyAuthError(e)); } finally { entering.current = false; setBusy(false); }
  }
  async function recover() {
    if (local || entering.current || busy) return;
    setPhase('Enviando as instruções…');
    setBusy(true); setError(''); setNotice('');
    try { await recoverPassword(identity); setNotice('Se houver conta para este e-mail, enviaremos as instruções.'); }
    catch (e) { setError(friendlyAuthError(e)); } finally { setBusy(false); }
  }
  const matchingCandidate = candidate?.origem === (local ? 'local' : 'firebase') ? candidate : null;
  return <Formulario title={local ? 'Entrar com conta local' : 'Entrar com e-mail'} onVoltar={onVoltar} error={error}>
    <Aviso>{local ? 'A conta local permite consultar bares e endereços sem internet.' : 'Entre com e-mail e senha. Para avaliar ou gerenciar bares, verifique seu e-mail.'}</Aviso>
    <Campo label={local ? 'Usuário local' : 'E-mail'} value={identity} onChangeText={setIdentity} keyboardType={local ? 'default' : 'email-address'} editable={!busy}/>
    <Campo label="Senha" value={password} onChangeText={setPassword} secureTextEntry editable={!busy}/>
    {!!notice && <Aviso>{notice}</Aviso>}
    {busy && <View accessibilityLiveRegion="polite" style={{alignItems:'center',gap:8,paddingVertical:12}}><ActivityIndicator color="#6c63ff"/><Text style={{textAlign:'center'}}>{phase}</Text></View>}
    <Botao disabled={busy} onPress={enter}>{busy ? 'Aguarde...' : 'Entrar'}</Botao>
    {!local && <Botao secondary disabled={busy || !identity.trim()} onPress={recover}>Esqueci minha senha</Botao>}
    {matchingCandidate && <Botao secondary disabled={busy} onPress={() => onEntrarComBiometria(matchingCandidate)}>Entrar com biometria como {matchingCandidate.usuario}</Botao>}
    <Botao secondary disabled={busy} onPress={onAbrirCadastro}>{local ? 'Criar conta local' : 'Criar conta com e-mail'}</Botao>
    <Botao secondary disabled={busy} onPress={onConsultar}>Voltar aos bares sem entrar</Botao>
  </Formulario>;
}
