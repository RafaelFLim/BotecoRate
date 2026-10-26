import { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import { Campo, Botao, Aviso } from './Formulario';
import { consultarCep } from '../services/cepService';

export default function CampoEndereco({ endereco, onChange, disabled = false }) {
  const [cep, setCep] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const current = useRef(null);

  function cancel() {
    current.current?.abort();
    current.current = null;
  }
  useEffect(() => {
    cancel(); setBusy(false); setResult(null);
    return cancel;
  }, [endereco, disabled]);

  function changeCep(value) {
    cancel(); setBusy(false); setResult(null); setMessage(''); setCep(value);
  }
  async function search() {
    if (disabled || current.current) return;
    const request = new AbortController();
    current.current = request;
    setBusy(true); setResult(null); setMessage('');
    try {
      const found = await consultarCep(cep, { signal: request.signal });
      if (current.current === request) setResult(found);
    } catch (error) {
      if (current.current === request) setMessage(error.message);
    } finally {
      if (current.current === request) { current.current = null; setBusy(false); }
    }
  }
  return <>
    <Campo label="CEP (opcional)" value={cep} onChangeText={changeCep} editable={!disabled}
      placeholder="00000-000" keyboardType="number-pad" maxLength={9} onSubmitEditing={search}/>
    <Botao secondary disabled={disabled || busy} onPress={search}>{busy ? 'Buscando endereço…' : 'Buscar endereço pelo CEP'}</Botao>
    {!!message && <Text accessibilityRole="alert" style={{ color: '#b91c1c', marginVertical: 10 }}>{message}</Text>}
    {result && <>
      <Aviso>{result.endereco}{result.incompleto ? '\nEste CEP não informa a rua. Complete o endereço após aplicar.' : '\nConfira o endereço antes de aplicar.'}</Aviso>
      <Botao disabled={disabled} onPress={() => { onChange(result.endereco); setResult(null); }}>Usar este endereço</Botao>
    </>}
    <Campo label="Endereço completo" value={endereco || ''} onChangeText={value => {
      cancel(); setBusy(false); setResult(null); setMessage(''); onChange(value);
    }} editable={!disabled} maxLength={500} autoCapitalize="sentences"
      placeholder="Rua, número, complemento, bairro e cidade"/>
    <Aviso>Inclua o número e o complemento, se houver. Você também pode digitar todo o endereço sem consultar o CEP. Consulta por ViaCEP.</Aviso>
  </>;
}
