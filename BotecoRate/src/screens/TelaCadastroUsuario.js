import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Formulario, Campo, Botao, Aviso, MensagemErro } from '../components/Formulario';
import { createLocalAccount, registerFirebase, friendlyAuthError } from '../services/authService';
import { useUnsavedChanges } from '../navigation/useUnsavedChanges';
import { firebaseConfigured } from '../services/firebaseConfig';
import { validatedUsername } from '../utils/username';

export default function TelaCadastroUsuario({ accountType, onVoltar, onCadastrar }) {
  const navigation = useNavigation();
  const [name, setName] = useState(''); const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState('');
  const local = accountType === 'local'; const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false); const [error, setError] = useState('');
  const [nameError, setNameError] = useState('');
  const [confirmationError, setConfirmationError] = useState('');
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
  }
  async function save() {
    if (saving.current) return;
    Keyboard.dismiss();
    try { validatedUsername(name); }
    catch(e){setNameError(e.message);showError(e.message);return;}
    if (password !== confirm) { setConfirmationError('Digite a mesma senha nos dois campos.');showError('As senhas precisam ser iguais.'); return; }
    saving.current = true;
    setBusy(true); setError(''); setNameError(''); setConfirmationError('');
    setPhase(local ? 'Preparando sua conta…' : 'Criando sua conta…');
    try {
      if (local) await createLocalAccount(name, password, setPhase); else {
        const result = await registerFirebase(name, email, password);
        if (!result.verificationSent) setError('A conta foi criada, mas o envio do e-mail falhou. Entre e reenvie a verificação pelo perfil.');
      }
      setSaved(true); setPassword(''); setConfirm('');
    } catch (e) {const text=friendlyAuthError(e);showError(text);if(e.code==='profile/name-in-use'||text.includes('usuário já existe'))setNameError(text);} finally { saving.current = false; setBusy(false); }
  }
  return <Formulario title={local ? 'Criar conta local' : 'Criar conta com e-mail'} onVoltar={onVoltar} error={error}>
    {saved ? <><Aviso>{local ? 'Conta criada! Abrindo os bares disponíveis neste aparelho…' : error ? 'Sua conta foi criada. Entre e reenvie a confirmação pelo perfil.' : 'Conta criada. Abra o e-mail de verificação antes de fazer alterações no app.'}</Aviso>{!local && <Botao onPress={onCadastrar}>Continuar</Botao>}</> : <>
      {!local && !firebaseConfigured && <MensagemErro>O cadastro por e-mail está indisponível nesta versão. Você pode voltar ao perfil e escolher uma conta local para consultar os bares.</MensagemErro>}
      <Aviso>{local ? 'Sua conta fica neste aparelho e permite consultar bares e endereços. Depois, você poderá ativá-la com um e-mail.' : 'Crie sua conta para avaliar bares e acessar seu perfil em outros aparelhos.'}</Aviso>
      <Aviso>A senha precisa de 8 caracteres, uma maiúscula e um caractere especial.</Aviso>
      <Aviso>O nome precisa de pelo menos 3 letras, sem emojis. Números e pontuação não contam como letras. Nomes iguais, mesmo com diferenças de maiúsculas, acentos, espaços ou pontuação, não podem ser repetidos.</Aviso>
      <Campo label={local ? 'Usuário local' : 'Nome de perfil'} value={name} onChangeText={value=>{setName(value);setNameError('');setError('');}} error={nameError} editable={!busy} maxLength={100} />
      {!local && <Campo label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" editable={!busy} />}
      <Campo label="Senha" value={password} onChangeText={value=>{setPassword(value);setError('');setConfirmationError('');}} secureTextEntry editable={!busy} />
      <Campo label="Confirmar senha" value={confirm} onChangeText={value=>{setConfirm(value);setError('');setConfirmationError('');}} error={confirmationError} secureTextEntry editable={!busy} />
      {busy && <View accessibilityLiveRegion="polite" style={{alignItems:'center',gap:8,padding:12}}><ActivityIndicator color="#6c63ff"/><Text>{phase}</Text>{takingLong && <Aviso>A proteção da sua senha está levando um pouco mais de tempo neste aparelho. Mantenha o app aberto até concluir.</Aviso>}</View>}
      <Botao onPress={save} disabled={busy || (!local && !firebaseConfigured)}>{busy ? 'Criando conta…' : 'Criar conta'}</Botao>
    </>}
  </Formulario>;
}
