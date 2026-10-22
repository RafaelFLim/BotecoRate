import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Formulario, Campo, Botao, Aviso } from '../components/Formulario';
import { createLocalAccount, registerFirebase, friendlyAuthError } from '../services/authService';
import { useUnsavedChanges } from '../navigation/useUnsavedChanges';
import { firebaseConfigured } from '../services/firebaseConfig';

export default function TelaCadastroUsuario({ onVoltar, onCadastrar }) {
  const navigation = useNavigation();
  const [name, setName] = useState(''); const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState('');
  const [local, setLocal] = useState(false); const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [saved, setSaved] = useState(false); const [error, setError] = useState('');
  const [phase, setPhase] = useState(''); const [takingLong, setTakingLong] = useState(false);
  const saving = useRef(false);
  useUnsavedChanges(!saved && Boolean(name || email || password), navigation, {saving:busy});
  useEffect(() => {
    if (saved && local && !busy) onCadastrar();
  }, [saved, local, busy, onCadastrar]);
  useEffect(() => {
    setTakingLong(false);
    if (!busy) return;
    const timer = setTimeout(()=>setTakingLong(true), 8000);
    return ()=>clearTimeout(timer);
  }, [busy]);
  function showError(message) {
    setError(message);
    Alert.alert('Não foi possível criar a conta', message);
  }
  async function save() {
    if (saving.current) return;
    Keyboard.dismiss();
    if (!name.trim()) { showError('Informe seu nome.'); return; }
    if (password !== confirm) { showError('As senhas precisam ser iguais.'); return; }
    saving.current = true;
    setBusy(true); setError('');
    setPhase(local ? 'Preparando sua conta…' : 'Criando sua conta…');
    try {
      if (local) await createLocalAccount(name, password, setPhase); else {
        const result = await registerFirebase(name, email, password);
        if (!result.verificationSent) setNotice('A conta foi criada, mas o envio do e-mail falhou. Entre e reenvie a verificação pelo perfil.');
      }
      setSaved(true); setPassword(''); setConfirm('');
    } catch (e) { showError(friendlyAuthError(e)); } finally { saving.current = false; setBusy(false); }
  }
  return <Formulario title="Criar conta" onVoltar={onVoltar}>
    {saved ? <><Aviso>{notice || (local ? 'Conta criada! Abrindo os bares disponíveis neste aparelho…' : 'Conta criada. Abra o e-mail de verificação antes de fazer alterações no app.')}</Aviso>{!local && <Botao onPress={onCadastrar}>Continuar</Botao>}</> : <>
      {!!error && <Text accessibilityRole="alert" style={{color:'#b42318',marginVertical:12}}>{error}</Text>}
      {!local && !firebaseConfigured && <Aviso>O cadastro por e-mail está indisponível nesta versão. Você pode criar uma conta neste aparelho para consultar os bares.</Aviso>}
      <Aviso>{local ? 'Sua conta fica neste aparelho e permite consultar bares e endereços. Depois, você poderá ativá-la com um e-mail.' : 'Crie sua conta para avaliar bares e acessar seu perfil em outros aparelhos.'}</Aviso>
      <Aviso>A senha precisa de 8 caracteres, uma maiúscula e um caractere especial.</Aviso>
      <Campo label={local ? 'Usuário local' : 'Nome de perfil'} value={name} onChangeText={setName} editable={!busy} />
      {!local && <Campo label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" editable={!busy} />}
      <Campo label="Senha" value={password} onChangeText={setPassword} secureTextEntry editable={!busy} />
      <Campo label="Confirmar senha" value={confirm} onChangeText={setConfirm} secureTextEntry editable={!busy} />
      {busy && <View accessibilityLiveRegion="polite" style={{alignItems:'center',gap:8,padding:12}}><ActivityIndicator color="#6c63ff"/><Text>{phase}</Text>{takingLong && <Aviso>A proteção da sua senha está levando um pouco mais de tempo neste aparelho. Mantenha o app aberto até concluir.</Aviso>}</View>}
      <Botao onPress={save} disabled={busy || (!local && !firebaseConfigured)}>{busy ? 'Criando conta…' : 'Criar conta'}</Botao>
      <Botao secondary disabled={busy} onPress={() => { setLocal(!local); setError(''); }}>{local ? 'Cadastrar com e-mail' : 'Criar conta neste aparelho'}</Botao>
    </>}
  </Formulario>;
}
