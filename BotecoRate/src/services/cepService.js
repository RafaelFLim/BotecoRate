export function validarCep(value) {
  const cep = String(value ?? '').trim();
  if (!/^\d{5}-?\d{3}$/.test(cep)) throw new Error('Digite um CEP com oito números.');
  return cep.replace('-', '');
}

export function formatarEnderecoCep(data, cep) {
  if (!data || typeof data !== 'object' || data.erro === true || data.erro === 'true') {
    throw new Error('CEP não encontrado. Confira os números ou digite o endereço manualmente.');
  }
  if (validarCep(data.cep) !== cep || typeof data.localidade !== 'string' || !data.localidade.trim() || !/^[A-Z]{2}$/.test(data.uf)
    || ['logradouro', 'bairro'].some(field => data[field] != null && typeof data[field] !== 'string')) {
    throw new Error('Não foi possível reconhecer o endereço. Tente novamente ou preencha manualmente.');
  }
  // Complemento do ViaCEP descreve a faixa do logradouro, não o imóvel do bar.
  return [data.logradouro, data.bairro, `${data.localidade} - ${data.uf}`]
    .filter(value => typeof value === 'string' && value.trim()).map(value => value.trim()).join(' - ');
}

export async function consultarCep(value, { signal, fetchImpl = globalThis.fetch, timeoutMs = 10000 } = {}) {
  const cep = validarCep(value);
  const controller = new AbortController();
  let timer;
  let cancel;
  const interruption = new Promise((_, reject) => {
    cancel = () => { controller.abort(); reject(new Error('Consulta cancelada.')); };
    if (signal?.aborted) cancel();
    else signal?.addEventListener('abort', cancel, { once: true });
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('A consulta demorou demais. Tente novamente ou digite o endereço manualmente.'));
    }, timeoutMs);
  });
  try {
    const request = async () => {
      if (signal?.aborted) throw new Error('Consulta cancelada.');
      let response;
      try { response = await fetchImpl(`https://viacep.com.br/ws/${cep}/json/`, { signal: controller.signal }); }
      catch { throw new Error('Não foi possível consultar o CEP. Confira a conexão ou digite o endereço manualmente.'); }
      if (!response.ok) throw new Error('A consulta de CEP está indisponível. Tente novamente ou preencha manualmente.');
      let data;
      try { data = await response.json(); }
      catch { throw new Error('A consulta retornou uma resposta inválida. Tente novamente ou preencha manualmente.'); }
      return { cep, endereco: formatarEnderecoCep(data, cep), incompleto: !data.logradouro?.trim() };
    };
    return await Promise.race([interruption, request()]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}
