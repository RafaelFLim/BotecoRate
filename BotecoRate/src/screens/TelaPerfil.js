import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useUnsavedChanges } from '../navigation/useUnsavedChanges';
import { Formulario, Campo, Botao, Aviso } from '../components/Formulario';
import { activateLocalAccount, changeProfileName, changePassword, refreshSession, resendVerification, friendlyAuthError } from '../services/authService';

export default function TelaPerfil({ usuarioLogado, onVoltar, onSair }) {
  const navigation = useNavigation();
  const [name, setName] = useState(usuarioLogado?.usuario || '');
  const [email, setEmail] = useState(''); const [current, setCurrent] = useState('');
  const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(''); const [existing, setExisting] = useState(false);
  useUnsavedChanges(Boolean(current || password || (name !== (usuarioLogado?.usuario || ''))), navigation);
  async function perform(action, success) {
    setBusy(true); setMessage('');
    try { await action(); setCurrent(''); setPassword(''); setMessage(success); }
    catch (e) { setMessage(friendlyAuthError(e)); } finally { setBusy(false); }
  }
  if (!usuarioLogado) return <Formulario title="Perfil" onVoltar={onVoltar}><Aviso>Entre para acessar sua conta.</Aviso></Formulario>;
  const local = usuarioLogado.origem === 'local';
  return <Formulario title="Minha conta" onVoltar={onVoltar}>
    <Aviso>{local ? 'Conta local: somente consulta.' : usuarioLogado.email + ' — ' + usuarioLogado.papel + (usuarioLogado.emailVerificado ? ' — e-mail verificado' : ' — e-mail ainda não verificado')}</Aviso>
    <Campo label="Nome de perfil" value={name} onChangeText={setName} />
    <Botao disabled={busy} onPress={() => perform(() => changeProfileName(name), 'Nome atualizado.')}>Salvar nome</Botao>
    {!local && !usuarioLogado.emailVerificado && <>
      <Botao secondary disabled={busy} onPress={() => perform(resendVerification, 'E-mail enviado. Confira também a caixa de spam.')}>Reenviar verificação</Botao>
      <Botao secondary disabled={busy} onPress={() => perform(refreshSession, 'Situação da conta atualizada.')}>Já verifiquei meu e-mail</Botao>
    </>}
    {local && <>
      <Aviso>Ative sua conta com internet. Digite a senha novamente; sua senha local não será enviada automaticamente.</Aviso>
      <Campo label="E-mail para ativar" value={email} onChangeText={setEmail} keyboardType="email-address" />
      <Campo label="Senha da conta Firebase" value={password} onChangeText={setPassword} secureTextEntry />
      <Botao secondary disabled={busy} onPress={() => setExisting(!existing)}>{existing ? 'Usando um e-mail já cadastrado' : 'Criando uma conta com este e-mail'}</Botao>
      <Botao disabled={busy} onPress={() => perform(() => activateLocalAccount(email, password, existing), 'Conta ativada. Verifique o e-mail para interagir.')}>Ativar conta</Botao>
    </>}
    <Aviso>Trocar senha</Aviso>
    <Campo label="Senha atual" value={current} onChangeText={setCurrent} secureTextEntry />
    <Campo label="Nova senha" value={password} onChangeText={setPassword} secureTextEntry />
    <Botao disabled={busy} onPress={() => perform(() => changePassword(current, password), 'Senha alterada.')}>Salvar senha</Botao>
    {!!message && <Aviso>{message}</Aviso>}
    <Botao secondary disabled={busy} onPress={onSair}>Sair da conta</Botao>
  </Formulario>;
}
