import { useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { Formulario, Campo, Botao, Aviso, OpcaoConta } from '../components/Formulario';
import { useUnsavedChanges } from '../navigation/useUnsavedChanges';
import { validatedUsername } from '../utils/username';
import { activateLocalAccount, changeProfileName, changePassword, requestPasswordChange, refreshSession, resendVerification, friendlyAuthError, biometricCandidate } from '../services/authService';

export function TelaEscolhaVinculo({ onVoltar, onEscolher }) {
  return <Formulario title="Usar uma conta com e-mail" onVoltar={onVoltar}>
    <Aviso>Escolha como continuar. Você precisa de internet para criar ou vincular sua conta.</Aviso>
    <OpcaoConta title="Criar uma conta com e-mail" description="Ainda não tenho uma conta com e-mail no BotecoRate." onPress={()=>onEscolher(false)}/>
    <OpcaoConta title="Já tenho uma conta" description="Quero entrar na minha conta existente e vinculá-la a este aparelho." onPress={()=>onEscolher(true)}/>
  </Formulario>;
}

const titles = { dados: 'Meus dados', nome: 'Trocar nome de usuário', senha: 'Trocar senha', verificacao: 'Confirmar meu e-mail', acesso: 'Acesso e segurança' };

export default function TelaAjusteConta({ usuarioLogado, secao, existing = false, onVoltar, onPerfil, onAbrirOpcao, onSair, onBloquear }) {
  const navigation = useNavigation();
  const [name, setName] = useState(usuarioLogado.usuario);
  const [email, setEmail] = useState('');
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [linked, setLinked] = useState(false);
  const [biometricReady, setBiometricReady] = useState(false);
  const [checkingBiometrics, setCheckingBiometrics] = useState(secao === 'acesso');
  const performing = useRef(false);
  const local = usuarioLogado.origem === 'local';
  const dirty = secao === 'nome' ? name !== usuarioLogado.usuario
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
    setBusy(true); setMessage(''); setError(''); setFieldErrors({});
    try {
      const result = await action();
      cleanup?.(result);
      setMessage(typeof success === 'function' ? success(result) : success);
    } catch (error) {
      const text=friendlyAuthError(error);setError(text);
      if(secao==='nome'&&(error.code==='profile/name-in-use'||text.includes('usuário já existe')))setFieldErrors({name:text});
      if(secao==='senha'&&text.includes('Senha atual incorreta'))setFieldErrors({current:text});
    }
    finally { performing.current = false; setBusy(false); }
  }

  function savePassword() {
    if (password !== confirmation) { setMessage('');setError('As senhas precisam ser iguais.');setFieldErrors({confirmation:'Digite a mesma senha nos dois campos.'});return; }
    perform(()=>changePassword(current, password), 'Senha alterada.', ()=>{setCurrent('');setPassword('');setConfirmation('');});
  }

  function linkAccount() {
    if (!existing && password !== confirmation) { setMessage('');setError('As senhas precisam ser iguais.');setFieldErrors({confirmation:'Digite a mesma senha nos dois campos.'});return; }
    perform(()=>activateLocalAccount(email, password, existing), result=>existing
      ? 'Conta vinculada com sucesso. Consulte sua conta para conferir a confirmação do e-mail.'
      : result.verificationSent
        ? 'Conta criada! Abra o e-mail de confirmação para começar a participar.'
        : 'Conta criada. Acesse “Confirmar meu e-mail” no perfil para reenviar a confirmação.',
    result=>{setLinked(true);setEmail('');setPassword('');setConfirmation('');if(!existing&&!result.verificationSent)setError('A conta foi criada, mas não foi possível enviar a confirmação. Acesse Confirmar meu e-mail para reenviar.');});
  }

  function saveName() {
    try { validatedUsername(name,usuarioLogado.usuario); }
    catch(e){setMessage('');setError(e.message);setFieldErrors({name:e.message});return;}
    return perform(()=>changeProfileName(name),'Nome atualizado.',result=>setName(result.usuario));
  }
  function edit(setter,value) { setter(value);setError('');setMessage('');setFieldErrors({}); }

  return <Formulario title={titles[secao] || (existing ? 'Vincular minha conta' : 'Criar conta com e-mail')} onVoltar={onVoltar} error={error}>
    {!!message && <Aviso>{message}</Aviso>}
    {secao === 'dados' && <>
      <Aviso>{usuarioLogado.usuario}{local?'\nConta local deste aparelho.':`\n${usuarioLogado.email}`}</Aviso>
      <OpcaoConta title="Trocar nome de usuário" description="Escolha outro nome, com pelo menos três letras e sem emojis." onPress={()=>onAbrirOpcao('nome')}/>
      <OpcaoConta title="Troca de senha" description={local?'Confirme sua senha atual e informe a nova senha.':'Receba um link no seu e-mail para confirmar e concluir a troca.'} onPress={()=>onAbrirOpcao('senha')}/>
    </>}
    {secao === 'nome' && <>
      <Aviso>{local ? 'Conta local: seus dados ficam neste aparelho.' : `E-mail: ${usuarioLogado.email}\n${usuarioLogado.emailVerificado ? 'E-mail confirmado.' : 'E-mail ainda não confirmado. Confirme-o antes de alterar o nome.'}`}</Aviso>
      <Aviso>Use pelo menos 3 letras e no máximo 100 caracteres. Pode combinar letras, números, espaços, pontos, hífen, apóstrofo ou sublinhado; não use emojis. Diferenças apenas de maiúsculas, acentos, espaços e pontuação não tornam um nome diferente. {local?'A disponibilidade vale neste aparelho. Ao vincular um e-mail, ela será conferida no cadastro online.':'O nome precisa estar disponível no BotecoRate.'}</Aviso>
      <Campo label="Novo nome de usuário" value={name} onChangeText={value=>edit(setName,value)} error={fieldErrors.name} editable={!busy} maxLength={100}/>
      <Botao disabled={busy || name===usuarioLogado.usuario || (!local && !usuarioLogado.emailVerificado)} onPress={saveName}>{busy ? 'Salvando…' : 'Salvar nome'}</Botao>
    </>}
    {secao === 'senha' && <>
      {local?<>
      <Aviso>Troque a senha da conta local deste aparelho. Esta conta não tem e-mail: a confirmação é feita pela senha atual. Use pelo menos 8 caracteres, uma letra maiúscula e um caractere especial.</Aviso>
      <Campo label="Senha atual" value={current} onChangeText={value=>edit(setCurrent,value)} error={fieldErrors.current} secureTextEntry editable={!busy}/>
      <Campo label="Nova senha" value={password} onChangeText={value=>edit(setPassword,value)} secureTextEntry editable={!busy}/>
      <Campo label="Confirme a nova senha" value={confirmation} onChangeText={value=>edit(setConfirmation,value)} error={fieldErrors.confirmation} secureTextEntry editable={!busy}/>
      <Botao disabled={busy} onPress={savePassword}>{busy ? 'Salvando…' : 'Salvar senha'}</Botao>
      </>:<>
        <Aviso>A nova senha deverá ter pelo menos 8 caracteres, uma letra maiúscula e um caractere especial.</Aviso>
        <Aviso>Para confirmar que é você, enviaremos um link para {usuarioLogado.email}. Abra o e-mail e defina a nova senha na página segura. A senha atual continua válida até você concluir a troca pelo link. Depois, entre novamente com a nova senha.</Aviso>
        <Botao disabled={busy} onPress={()=>perform(requestPasswordChange,'Link enviado. Confira sua caixa de entrada e o spam. A senha só será alterada ao concluir o link recebido.')}>{busy?'Enviando…':'Enviar confirmação por e-mail'}</Botao>
      </>}
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
        <Campo label="E-mail" value={email} onChangeText={value=>edit(setEmail,value)} keyboardType="email-address" editable={!busy}/>
        <Campo label={existing ? 'Senha da sua conta no BotecoRate' : 'Crie uma senha para sua conta'} value={password} onChangeText={value=>edit(setPassword,value)} secureTextEntry editable={!busy}/>
        {!existing && <>
          <Aviso>Use pelo menos 8 caracteres, uma letra maiúscula e um caractere especial.</Aviso>
          <Campo label="Confirme a senha" value={confirmation} onChangeText={value=>edit(setConfirmation,value)} error={fieldErrors.confirmation} secureTextEntry editable={!busy}/>
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
