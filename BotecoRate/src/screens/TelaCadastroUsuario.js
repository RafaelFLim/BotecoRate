import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { Formulario, Campo, Botao, Aviso } from '../components/Formulario';
import { createLocalAccount, registerFirebase, friendlyAuthError } from '../services/authService';
import { useUnsavedChanges } from '../navigation/useUnsavedChanges';

export default function TelaCadastroUsuario({ onVoltar, onCadastrar }) {
  const navigation = useNavigation();
  const [name, setName] = useState(''); const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState('');
  const [local, setLocal] = useState(false); const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [saved, setSaved] = useState(false); const [error, setError] = useState('');
  useUnsavedChanges(!saved && Boolean(name || email || password), navigation);
  async function save() {
    if (password !== confirm) { setError('As senhas precisam ser iguais.'); return; }
    setBusy(true); setError('');
    try {
      if (local) await createLocalAccount(name, password); else {
        const result = await registerFirebase(name, email, password);
        if (!result.verificationSent) setNotice('A conta foi criada, mas o envio do e-mail falhou. Entre e reenvie a verificação pelo perfil.');
      }
      setSaved(true); setPassword(''); setConfirm('');
    } catch (e) { setError(friendlyAuthError(e)); } finally { setBusy(false); }
  }
  return <Formulario title="Criar conta" onVoltar={onVoltar}>
    {saved ? <><Aviso>{notice || (local ? 'Conta local criada. Entre com seu usuário e senha para consultar.' : 'Conta criada. Abra o e-mail de verificação antes de fazer alterações no app.')}</Aviso><Botao onPress={onCadastrar}>Continuar</Botao></> : <>
      <Aviso>{local ? 'Conta somente neste aparelho, sem autenticação Firebase. Você poderá ativá-la depois.' : 'A senha precisa de 8 caracteres, uma maiúscula e um caractere especial.'}</Aviso>
      <Campo label={local ? 'Usuário local' : 'Nome de perfil'} value={name} onChangeText={setName} />
      {!local && <Campo label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" />}
      <Campo label="Senha" value={password} onChangeText={setPassword} secureTextEntry />
      <Campo label="Confirmar senha" value={confirm} onChangeText={setConfirm} secureTextEntry />
      {!!error && <Aviso>{error}</Aviso>}
      <Botao onPress={save} disabled={busy}>{busy ? 'Criando conta...' : 'Criar conta'}</Botao>
      <Botao secondary disabled={busy} onPress={() => setLocal(!local)}>{local ? 'Cadastrar com e-mail' : 'Criar conta local offline'}</Botao>
    </>}
  </Formulario>;
}
