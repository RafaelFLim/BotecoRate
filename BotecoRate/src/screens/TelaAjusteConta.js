import { useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { Formulario, Campo, Botao, Aviso, OpcaoConta } from '../components/Formulario';
import { useUnsavedChanges } from '../navigation/useUnsavedChanges';
import { activateLocalAccount, changeProfileName, changePassword, refreshSession, resendVerification, friendlyAuthError, biometricCandidate } from '../services/authService';

export function TelaEscolhaVinculo({ onVoltar, onEscolher }) {
  return <Formulario title="Usar uma conta com e-mail" onVoltar={onVoltar}>
    <Aviso>Escolha como continuar. Você precisa de internet para criar ou vincular sua conta.</Aviso>
    <OpcaoConta title="Criar uma conta com e-mail" description="Ainda não tenho uma conta com e-mail no BotecoRate." onPress={()=>onEscolher(false)}/>
    <OpcaoConta title="Já tenho uma conta" description="Quero entrar na minha conta existente e vinculá-la a este aparelho." onPress={()=>onEscolher(true)}/>
  </Formulario>;
}

const titles = { dados: 'Meus dados', senha: 'Trocar senha', verificacao: 'Confirmar meu e-mail', acesso: 'Acesso e segurança' };

export default function TelaAjusteConta({ usuarioLogado, secao, existing = false, onVoltar, onPerfil, onSair, onBloquear }) {
  const navigation = useNavigation();
  const [name, setName] = useState(usuarioLogado.usuario);
  const [email, setEmail] = useState('');
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [linked, setLinked] = useState(false);
  const [biometricReady, setBiometricReady] = useState(false);
  const [checkingBiometrics, setCheckingBiometrics] = useState(secao === 'acesso');
  const performing = useRef(false);
  const local = usuarioLogado.origem === 'local';
  const dirty = secao === 'dados' ? name !== usuarioLogado.usuario
    : secao === 'senha' ? Boolean(current || password || confirmation)
    : secao === 'vinculo' && !linked ? Boolean(email || password || confirmation) : false;
  useUnsavedChanges(dirty, navigation, { saving: busy && secao !== 'acesso' });

  useEffect(() => {
    if (secao !== 'acesso') return;
    let active = true;
    biometricCandidate().then(candidate => {
      if (active) setBiometricReady(candidate?.id === usuarioLogado.id);
    }).catch(() => {}).finally(() => { if (active) setCheckingBiometrics(false); });
    return () => { active = false; };
  }, [secao, usuarioLogado.id]);

  async function perform(action, success = '', cleanup) {
    if (performing.current) return;
    performing.current = true;
    setBusy(true); setMessage('');
    try {
      const result = await action();
      cleanup?.();
      setMessage(typeof success === 'function' ? success(result) : success);
    } catch (error) { setMessage(friendlyAuthError(error)); }
    finally { performing.current = false; setBusy(false); }
  }

  function savePassword() {
    if (password !== confirmation) { setMessage('As senhas precisam ser iguais.'); return; }
    perform(()=>changePassword(current, password), 'Senha alterada.', ()=>{setCurrent('');setPassword('');setConfirmation('');});
  }

  function linkAccount() {
    if (!existing && password !== confirmation) { setMessage('As senhas precisam ser iguais.'); return; }
    perform(()=>activateLocalAccount(email, password, existing), result=>existing
      ? 'Conta vinculada com sucesso. Consulte sua conta para conferir a confirmação do e-mail.'
      : result.verificationSent
        ? 'Conta criada! Abra o e-mail de confirmação para começar a participar.'
        : 'Conta criada. Acesse “Confirmar meu e-mail” no perfil para reenviar a confirmação.',
    ()=>{setLinked(true);setEmail('');setPassword('');setConfirmation('');});
  }

  return <Formulario title={titles[secao] || (existing ? 'Vincular minha conta' : 'Criar conta com e-mail')} onVoltar={onVoltar}>
    {!!message && <Aviso>{message}</Aviso>}
    {secao === 'dados' && <>
      <Aviso>{local ? 'Conta local: seus dados ficam neste aparelho.' : `E-mail: ${usuarioLogado.email}\n${usuarioLogado.emailVerificado ? 'E-mail confirmado.' : 'E-mail ainda não confirmado. Confirme-o antes de alterar o nome.'}`}</Aviso>
      <Campo label="Nome de perfil" value={name} onChangeText={setName} editable={!busy}/>
      <Botao disabled={busy || (!local && !usuarioLogado.emailVerificado)} onPress={()=>perform(()=>changeProfileName(name), 'Nome atualizado.', ()=>setName(name.trim()))}>{busy ? 'Salvando…' : 'Salvar nome'}</Botao>
    </>}
    {secao === 'senha' && <>
      <Aviso>{local ? 'Troque a senha da conta local deste aparelho.' : 'Troque sua senha de acesso ao BotecoRate.'} Use pelo menos 8 caracteres, uma letra maiúscula e um caractere especial.</Aviso>
      <Campo label="Senha atual" value={current} onChangeText={setCurrent} secureTextEntry editable={!busy}/>
      <Campo label="Nova senha" value={password} onChangeText={setPassword} secureTextEntry editable={!busy}/>
      <Campo label="Confirme a nova senha" value={confirmation} onChangeText={setConfirmation} secureTextEntry editable={!busy}/>
      <Botao disabled={busy} onPress={savePassword}>{busy ? 'Salvando…' : 'Salvar senha'}</Botao>
    </>}
    {secao === 'verificacao' && <>
      <Aviso>{usuarioLogado.emailVerificado ? 'Seu e-mail está confirmado. Você já pode participar.' : `Enviamos a confirmação para ${usuarioLogado.email}. Abra o link recebido e depois confira a situação aqui.`}</Aviso>
      {!usuarioLogado.emailVerificado && <>
        <Botao disabled={busy} onPress={()=>perform(resendVerification, 'E-mail enviado. Confira também a caixa de spam.')}>Reenviar confirmação</Botao>
        <Botao secondary disabled={busy} onPress={()=>perform(refreshSession, result=>result?.emailVerificado ? 'E-mail confirmado!' : 'Seu e-mail ainda não foi confirmado. Abra o link recebido e tente novamente.')}>Já confirmei meu e-mail</Botao>
      </>}
    </>}
    {secao === 'vinculo' && <>
      {linked || (!local && !busy) ? <Botao onPress={onPerfil}>Voltar à minha conta</Botao> : <>
        <Aviso>{existing ? 'Entre com sua conta do BotecoRate para vinculá-la a este aparelho. Use a senha do aplicativo, não a senha da caixa de e-mail.' : 'Crie sua conta para usar o BotecoRate em outros aparelhos e participar das avaliações. Depois, confirme seu e-mail.'}</Aviso>
        <Campo label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" editable={!busy}/>
        <Campo label={existing ? 'Senha da sua conta no BotecoRate' : 'Crie uma senha para sua conta'} value={password} onChangeText={setPassword} secureTextEntry editable={!busy}/>
        {!existing && <>
          <Aviso>Use pelo menos 8 caracteres, uma letra maiúscula e um caractere especial.</Aviso>
          <Campo label="Confirme a senha" value={confirmation} onChangeText={setConfirmation} secureTextEntry editable={!busy}/>
        </>}
        <Botao disabled={busy} onPress={linkAccount}>{busy ? 'Aguarde…' : existing ? 'Entrar e vincular minha conta' : 'Criar minha conta com e-mail'}</Botao>
      </>}
    </>}
    {secao === 'acesso' && <>
      <Aviso>{checkingBiometrics ? 'Conferindo o acesso por biometria…' : biometricReady
        ? 'Acesso por biometria disponível. Bloquear o app permite voltar com sua digital ou reconhecimento facial, conforme seu aparelho.'
        : 'A biometria não está disponível para esta conta neste momento. Confira o cadastro biométrico nas configurações do aparelho e entre com sua senha para habilitar o acesso rápido.'}</Aviso>
      {biometricReady && <Botao disabled={busy} onPress={()=>perform(onBloquear)}>Bloquear app</Botao>}
      <Aviso>Ao sair da conta, será necessário entrar novamente com sua senha.</Aviso>
      <Botao secondary disabled={busy} onPress={()=>perform(onSair)}>Sair da conta</Botao>
    </>}
  </Formulario>;
}
