import { test, expect } from "@jest/globals";
import { consultarCep, validarCep } from '../src/services/cepService.js';
const address = {
  cep: '01001-000',
  logradouro: 'Praça da Sé',
  bairro: 'Sé',
  localidade: 'São Paulo',
  uf: 'SP',
  complemento: 'lado ímpar'
};
const reply = data => async () => ({
  ok: true,
  json: async () => data
});
test('consulta aceita CEP com ou sem hífen e rejeita formatos inválidos antes da rede', async () => {
  expect(validarCep('01001-000')).toBe('01001000');
  expect(validarCep('01001000')).toBe('01001000');
  let calls = 0;
  for (const value of ['', '123', '01001A00', '010010000', '01001/000']) {
    await expect(consultarCep(value, {
      fetchImpl: () => {
        calls++;
      }
    })).rejects.toThrow(/oito números/);
  }
  expect(calls).toBe(0);
});
test('consulta HTTPS não envia credenciais e não confunde complemento postal com número do imóvel', async () => {
  const result = await consultarCep('01001-000', {
    fetchImpl: async (url, options) => {
      expect(url).toBe('https://viacep.com.br/ws/01001000/json/');
      expect(Object.keys(options)).toEqual(['signal']);
      return {
        ok: true,
        json: async () => address
      };
    }
  });
  expect(result).toEqual({
    cep: '01001000',
    endereco: 'Praça da Sé - Sé - São Paulo - SP',
    incompleto: false,
    campos: {
      logradouro: 'Praça da Sé',
      bairro: 'Sé',
      cidade: 'São Paulo',
      uf: 'SP'
    }
  });
});
test('CEP geral permite completar a rua manualmente e CEP inexistente tem mensagem clara', async () => {
  expect(await consultarCep('01001000', {
    fetchImpl: reply({
      ...address,
      logradouro: '',
      bairro: ''
    })
  })).toEqual({
    cep: '01001000',
    endereco: 'São Paulo - SP',
    incompleto: true,
    campos: {
      logradouro: '',
      bairro: '',
      cidade: 'São Paulo',
      uf: 'SP'
    }
  });
  for (const erro of [true, 'true']) await expect(consultarCep('01001000', {
    fetchImpl: reply({
      erro
    })
  })).rejects.toThrow(/CEP não encontrado/);
});
test('rede indisponível, HTTP, JSON e dados inconsistentes não são aplicados como endereço', async () => {
  await expect(consultarCep('01001000', {
    fetchImpl: async () => {
      throw Error('offline');
    }
  })).rejects.toThrow(/conexão/);
  await expect(consultarCep('01001000', {
    fetchImpl: async () => ({
      ok: false
    })
  })).rejects.toThrow(/indisponível/);
  await expect(consultarCep('01001000', {
    fetchImpl: async () => ({
      ok: true,
      json: async () => {
        throw Error('json');
      }
    })
  })).rejects.toThrow(/resposta inválida/);
  for (const data of [null, [], {
    ...address,
    cep: '22222222'
  }, {
    ...address,
    uf: ''
  }, {
    ...address,
    bairro: 12
  }]) {
    await expect(consultarCep('01001000', {
      fetchImpl: reply(data)
    })).rejects.toThrow();
  }
});
test('timeout limita tanto espera de rede quanto leitura JSON e aborta a requisição', async () => {
  for (const jsonPending of [false, true]) {
    let requestSignal;
    const fetchImpl = async (_, {
      signal
    }) => {
      requestSignal = signal;
      return jsonPending ? {
        ok: true,
        json: () => new Promise(() => {})
      } : new Promise(() => {});
    };
    await expect(consultarCep('01001000', {
      fetchImpl,
      timeoutMs: 15
    })).rejects.toThrow(/demorou demais/);
    expect(requestSignal.aborted).toBe(true);
  }
});
test('cancelamento interrompe a espera mesmo quando transporte não responde ao abort', async () => {
  const controller = new AbortController();
  const pending = consultarCep('01001000', {
    signal: controller.signal,
    fetchImpl: () => new Promise(() => {})
  });
  controller.abort();
  await expect(pending).rejects.toThrow(/cancelada/);
  let calls = 0;
  await expect(consultarCep('01001000', {
    signal: controller.signal,
    fetchImpl: () => {
      calls++;
    }
  })).rejects.toThrow(/cancelada/);
  expect(calls).toBe(0);
});
