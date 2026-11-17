import { useEffect, useRef, useState } from 'react';
import { Campo, Botao, Aviso, MensagemErro } from './Formulario';
import { consultarCep } from '../services/cepService';
import { ADDRESS_FIELDS, addressFields, formatAddress, BRAZIL_UFS } from '../utils/address';

export default function CampoEndereco({ endereco, campos = {}, cepSalvo = null, onChange, onCepChange, onFieldFocus, disabled = false }) {
  const fields=addressFields(campos);
  const [expanded,setExpanded]=useState(false);
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
  function changeField(field,value) {
    cancel();setBusy(false);setResult(null);setMessage('');
    const next={...fields,[field]:value};
    onChange(formatAddress(next),next);
    onCepChange?.(['numero','complemento'].includes(field)?cepSalvo:null);
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
    <Campo label="CEP (opcional)" value={cep} onChangeText={changeCep} editable={!disabled} onFocus={onFieldFocus}
      placeholder="00000-000" keyboardType="number-pad" maxLength={9} onSubmitEditing={search}/>
    <Botao secondary disabled={disabled || busy} onPress={search}>{busy ? 'Buscando endereço…' : 'Buscar endereço pelo CEP'}</Botao>
    {!!message && <MensagemErro>{message}</MensagemErro>}
    {result && <>
      <Aviso>{result.endereco}{result.incompleto ? '\nEste CEP não informa a rua. Complete o endereço após aplicar.' : '\nConfira o endereço antes de aplicar.'}</Aviso>
      <Botao disabled={disabled} onPress={() => {
        if (!result.campos?.cidade || !BRAZIL_UFS.includes(result.campos.uf)) {
          setMessage('Consulte o CEP novamente para carregar a cidade e a UF.');setResult(null);return;
        }
        const next={...fields,...result.campos};
        onChange(formatAddress(next),next);onCepChange?.(result.cep);setResult(null);
      }}>Usar este endereço</Botao>
    </>}
    {!!endereco && !ADDRESS_FIELDS.some(field=>campos[field]) && <Aviso>Endereço anterior: {endereco}. Para alterá-lo, preencha os campos abaixo.</Aviso>}
    <Campo label="Rua / logradouro" value={fields.logradouro} onChangeText={value=>changeField('logradouro',value)} onFocus={onFieldFocus} editable={!disabled} maxLength={150} autoCapitalize="words"/>
    <Campo label="Número" value={fields.numero} onChangeText={value=>changeField('numero',value)} onFocus={onFieldFocus} editable={!disabled} maxLength={20} placeholder="Ex.: 123 ou S/N"/>
    <Campo label="Complemento (opcional)" value={fields.complemento} onChangeText={value=>changeField('complemento',value)} onFocus={onFieldFocus} editable={!disabled} maxLength={100} placeholder="Ex.: loja 2"/>
    <Campo label="Bairro (opcional)" value={fields.bairro} onChangeText={value=>changeField('bairro',value)} onFocus={onFieldFocus} editable={!disabled} maxLength={100} autoCapitalize="words"/>
    <Campo label="Cidade" value={fields.cidade} onChangeText={value=>changeField('cidade',value)} onFocus={onFieldFocus} editable={!disabled} maxLength={100} autoCapitalize="words"/>
    <Botao secondary disabled={disabled} onPress={()=>setExpanded(!expanded)}>UF · {fields.uf || 'Selecionar'} ▾</Botao>
    {expanded && BRAZIL_UFS.map(uf=><Botao key={uf} secondary disabled={disabled} onPress={()=>{changeField('uf',uf);setExpanded(false);}}>{uf}</Botao>)}
    <Aviso>Informe o número ou S/N. A consulta por ViaCEP preenche rua, bairro, cidade e UF. Você também pode preencher manualmente.</Aviso>
  </>;
}
