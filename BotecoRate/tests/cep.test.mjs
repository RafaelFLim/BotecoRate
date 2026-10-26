import test from 'node:test';
import assert from 'node:assert/strict';
import { consultarCep, validarCep } from '../src/services/cepService.js';

const address = { cep: '01001-000', logradouro: 'Praça da Sé', bairro: 'Sé', localidade: 'São Paulo', uf: 'SP', complemento: 'lado ímpar' };
const reply = data => async () => ({ ok: true, json: async () => data });

test('consulta aceita CEP com ou sem hífen e rejeita formatos inválidos antes da rede', async () => {
  assert.equal(validarCep('01001-000'), '01001000');
  assert.equal(validarCep('01001000'), '01001000');
  let calls = 0;
  for (const value of ['', '123', '01001A00', '010010000', '01001/000']) {
    await assert.rejects(consultarCep(value, { fetchImpl: () => { calls++; } }), /oito números/);
  }
  assert.equal(calls, 0);
});

test('consulta HTTPS não envia credenciais e não confunde complemento postal com número do imóvel', async () => {
  const result = await consultarCep('01001-000', { fetchImpl: async (url, options) => {
    assert.equal(url, 'https://viacep.com.br/ws/01001000/json/');
    assert.deepEqual(Object.keys(options), ['signal']);
    return { ok: true, json: async () => address };
  } });
  assert.deepEqual(result, { cep: '01001000', endereco: 'Praça da Sé - Sé - São Paulo - SP', incompleto: false });
});

test('CEP geral permite completar a rua manualmente e CEP inexistente tem mensagem clara', async () => {
  assert.deepEqual(await consultarCep('01001000', { fetchImpl: reply({ ...address, logradouro: '', bairro: '' }) }),
    { cep: '01001000', endereco: 'São Paulo - SP', incompleto: true });
  for (const erro of [true, 'true']) await assert.rejects(consultarCep('01001000', { fetchImpl: reply({ erro }) }), /CEP não encontrado/);
});

test('rede indisponível, HTTP, JSON e dados inconsistentes não são aplicados como endereço', async () => {
  await assert.rejects(consultarCep('01001000', { fetchImpl: async () => { throw Error('offline'); } }), /conexão/);
  await assert.rejects(consultarCep('01001000', { fetchImpl: async () => ({ ok: false }) }), /indisponível/);
  await assert.rejects(consultarCep('01001000', { fetchImpl: async () => ({ ok: true, json: async () => { throw Error('json'); } }) }), /resposta inválida/);
  for (const data of [null, [], { ...address, cep: '22222222' }, { ...address, uf: '' }, { ...address, bairro: 12 }]) {
    await assert.rejects(consultarCep('01001000', { fetchImpl: reply(data) }));
  }
});

test('timeout limita tanto espera de rede quanto leitura JSON e aborta a requisição', async () => {
  for (const jsonPending of [false, true]) {
    let requestSignal;
    const fetchImpl = async (_, { signal }) => {
      requestSignal = signal;
      return jsonPending ? { ok: true, json: () => new Promise(() => {}) } : new Promise(() => {});
    };
    await assert.rejects(consultarCep('01001000', { fetchImpl, timeoutMs: 15 }), /demorou demais/);
    assert.equal(requestSignal.aborted, true);
  }
});

test('cancelamento interrompe a espera mesmo quando transporte não responde ao abort', async () => {
  const controller = new AbortController();
  const pending = consultarCep('01001000', { signal: controller.signal, fetchImpl: () => new Promise(() => {}) });
  controller.abort();
  await assert.rejects(pending, /cancelada/);
  let calls = 0;
  await assert.rejects(consultarCep('01001000', { signal: controller.signal, fetchImpl: () => { calls++; } }), /cancelada/);
  assert.equal(calls, 0);
});
