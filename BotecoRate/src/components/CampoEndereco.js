import { useEffect, useRef, useState } from 'react';
import { Campo, Botao, Aviso, MensagemErro } from './Formulario';
import { consultarCep } from '../services/cepService';

export default function CampoEndereco({ endereco, onChange, cepSalvo = null, onCepChange, disabled = false }) {
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
    {!!message && <MensagemErro>{message}</MensagemErro>}
    {result && <>
      <Aviso>{result.endereco}{result.incompleto ? '\nEste CEP não informa a rua. Complete o endereço após aplicar.' : '\nConfira o endereço antes de aplicar.'}</Aviso>
      <Botao disabled={disabled} onPress={() => { onChange(result.endereco); onCepChange?.(result.cep); setResult(null); }}>Usar este endereço</Botao>
    </>}
    <Campo label="Endereço completo" value={endereco || ''} onChangeText={value => {
      cancel(); setBusy(false); setResult(null); setMessage(''); onChange(value);
    }} editable={!disabled} maxLength={500} autoCapitalize="sentences"
      placeholder="Rua, número, complemento, bairro e cidade"/>
    <Aviso>Inclua o número e o complemento, se houver. Você também pode digitar todo o endereço sem consultar o CEP. Consulta por ViaCEP.</Aviso>
    {onCepChange&&<>
      <Campo label="CEP registrado do estabelecimento (opcional)" value={cepSalvo||''} onChangeText={value=>onCepChange(value.trim().replace('-','')||null)} editable={!disabled} keyboardType="number-pad" maxLength={9}/>
      <Aviso>O CEP aplicado pela consulta é registrado aqui. Ao editar o endereço, confira e informe novamente o CEP deste estabelecimento. Pode preencher manualmente, inclusive sem internet.</Aviso>
    </>}
  </>;
}
