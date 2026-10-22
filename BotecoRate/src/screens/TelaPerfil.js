import { useEffect, useRef, useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useUnsavedChanges } from '../navigation/useUnsavedChanges';
import { Formulario, Campo, Botao, Aviso } from '../components/Formulario';
import { activateLocalAccount, changeProfileName, changePassword, refreshSession, resendVerification, friendlyAuthError, biometricCandidate } from '../services/authService';

export default function TelaPerfil({ usuarioLogado, onVoltar, onSair, onBloquear }) {
  const navigation = useNavigation();
  const [name, setName] = useState(usuarioLogado?.usuario || '');
  const [email, setEmail] = useState(''); const [current, setCurrent] = useState('');
  const [newPassword, setNewPassword] = useState(''); const [busy, setBusy] = useState(false);
  const [activationPassword, setActivationPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState(''); const [existing, setExisting] = useState(false);
  const [biometricReady, setBiometricReady] = useState(false);
  const performing = useRef(false);
  const local = usuarioLogado?.origem === 'local';
  const dirty = Boolean(usuarioLogado && (current || newPassword || activationPassword || confirmation || (local && email) || (name !== usuarioLogado.usuario)));
  useUnsavedChanges(dirty, navigation, {saving:busy});
  useEffect(() => {
    setName(usuarioLogado?.usuario || '');
    setEmail(''); setActivationPassword(''); setConfirmation('');
    setCurrent(''); setNewPassword('');
    let active = true;
    setBiometricReady(false);
    biometricCandidate().then(candidate=>{if(active)setBiometricReady(candidate?.id === usuarioLogado?.id && Boolean(candidate));}).catch(()=>{});
    return ()=>{active=false;};
  }, [usuarioLogado?.id]);
  async function perform(action, success, cleanup) {
    if (performing.current) return;
    performing.current = true;
    setBusy(true); setMessage('');
    try { const result = await action(); cleanup?.(); setMessage(typeof success === 'function' ? success(result) : success); }
    catch (e) { setMessage(friendlyAuthError(e)); } finally { performing.current = false; setBusy(false); }
  }
  function activate() {
    if (!existing && activationPassword !== confirmation) { setMessage('As senhas precisam ser iguais.'); return; }
    perform(()=>activateLocalAccount(email, activationPassword, existing), result=>{
      if (existing) return result.emailVerificado ? 'Conta vinculada com sucesso.' : 'Conta vinculada. Confirme seu e-mail para avaliar e participar.';
      return result.verificationSent ? 'Conta criada! Abra o e-mail de confirmação para começar a participar.' : 'Conta criada, mas não foi possível enviar a confirmação. Use “Reenviar verificação” abaixo.';
    });
  }
  function leave(action) {
    if (!dirty) { action(); return; }
    Alert.alert('Descartar alterações?', 'Há informações que ainda não foram salvas.', [
      {text:'Continuar editando',style:'cancel'},
      {text:'Descartar e continuar',style:'destructive',onPress:action},
    ]);
  }
  if (!usuarioLogado) return <Formulario title="Perfil" onVoltar={onVoltar}><Aviso>Entre para acessar sua conta.</Aviso></Formulario>;
  return <Formulario title="Minha conta" onVoltar={onVoltar}>
    <Aviso>{local ? 'Conta neste aparelho: disponível para consultar bares e endereços.' : usuarioLogado.email + (usuarioLogado.emailVerificado ? ' — e-mail confirmado' : ' — confirme seu e-mail para participar')}</Aviso>
    {!!message && <Aviso>{message}</Aviso>}
    <Campo label="Nome de perfil" value={name} onChangeText={setName} editable={!busy}/>
    <Botao disabled={busy} onPress={() => perform(() => changeProfileName(name), 'Nome atualizado.')}>Salvar nome</Botao>
    {!local && !usuarioLogado.emailVerificado && <>
      <Botao secondary disabled={busy} onPress={() => perform(resendVerification, 'E-mail enviado. Confira também a caixa de spam.')}>Reenviar verificação</Botao>
      <Botao secondary disabled={busy} onPress={() => perform(refreshSession, 'Situação da conta atualizada.')}>Já verifiquei meu e-mail</Botao>
    </>}
    {local && <>
      <Text style={{fontSize:18,fontWeight:'700',color:'#1a1a2e',marginTop:20}}>Usar uma conta com e-mail</Text>
      <Aviso>Escolha como continuar para usar sua conta em outros aparelhos e participar das avaliações. Você precisa estar conectado à internet.</Aviso>
      <View accessibilityRole="radiogroup" style={{gap:10,marginBottom:18}}>
        {[{value:false,title:'Criar uma conta com e-mail',description:'Ainda não tenho uma conta com e-mail no BotecoRate.'},{value:true,title:'Já tenho uma conta',description:'Quero entrar na minha conta existente e vinculá-la a este aparelho.'}].map(option=><TouchableOpacity key={String(option.value)} disabled={busy} accessibilityRole="radio" accessibilityState={{checked:existing === option.value,disabled:busy}}
          onPress={()=>{setExisting(option.value);setActivationPassword('');setConfirmation('');setMessage('');}}
          style={{padding:14,borderRadius:10,borderWidth:2,borderColor:existing === option.value ? '#6c63ff' : '#d1d5db',backgroundColor:existing === option.value ? '#eee9ff' : '#fff'}}>
          <Text style={{fontWeight:'700',color:'#1a1a2e'}}>{existing === option.value ? '● ' : '○ '}{option.title}</Text>
          <Text style={{color:'#4b5563',marginTop:5,lineHeight:20}}>{option.description}</Text>
        </TouchableOpacity>)}
      </View>
      <Campo label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" editable={!busy}/>
      <Campo label={existing ? 'Senha da sua conta no BotecoRate' : 'Crie uma senha para sua conta'} value={activationPassword} onChangeText={setActivationPassword} secureTextEntry editable={!busy}/>
      <Aviso>{existing ? 'Use a senha com que você já entra no BotecoRate, não a senha da sua caixa de e-mail.' : 'Use pelo menos 8 caracteres, uma letra maiúscula e um caractere especial.'}</Aviso>
      {!existing && <Campo label="Confirme a nova senha" value={confirmation} onChangeText={setConfirmation} secureTextEntry editable={!busy}/>}
      <Botao disabled={busy} onPress={activate}>{busy ? 'Aguarde…' : existing ? 'Entrar e vincular minha conta' : 'Criar minha conta com e-mail'}</Botao>
    </>}
    <Aviso>Trocar senha</Aviso>
    <Campo label="Senha atual" value={current} onChangeText={setCurrent} secureTextEntry editable={!busy}/>
    <Campo label="Nova senha" value={newPassword} onChangeText={setNewPassword} secureTextEntry editable={!busy}/>
    <Botao disabled={busy} onPress={() => perform(() => changePassword(current, newPassword), 'Senha alterada.', ()=>{setCurrent('');setNewPassword('');})}>Salvar senha</Botao>
    {biometricReady && <><Aviso>Bloquear o app permite voltar com biometria. Ao sair da conta, será necessário entrar novamente com sua senha.</Aviso><Botao disabled={busy} onPress={()=>leave(onBloquear)}>Bloquear app</Botao></>}
    <Botao secondary disabled={busy} onPress={()=>leave(onSair)}>Sair da conta</Botao>
  </Formulario>;
}
