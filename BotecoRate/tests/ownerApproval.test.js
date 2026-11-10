import { test, expect } from "@jest/globals";
import { isValidCnpj } from '../src/services/ownerApprovalProtocol.js';
import { podeCadastrarBar, podeGerenciarBar } from '../src/utils/permissoes.js';
test('CNPJ valida dígitos numéricos e alfanuméricos', () => {
  expect(isValidCnpj('00.000.000/E08G-12')).toBe(true);
  expect(isValidCnpj('04.252.011/0001-10')).toBe(true);
  for (const invalid of ['00.000.000/E08G-11', '00000000000000', '04.252.011/0001-11', '@@']) {
    expect(isValidCnpj(invalid)).toBe(false);
  }
});
test('convite permite gerenciar apenas bares vinculados e aprovação libera cadastro', () => {
  const owner = {
    id: 'dono',
    origem: 'firebase',
    papel: 'dono',
    status: 'ativo',
    emailVerificado: true
  };
  expect(podeCadastrarBar(owner)).toBe(false);
  expect(podeGerenciarBar(owner, {
    proprietarios: ['dono']
  })).toBe(true);
  expect(podeGerenciarBar(owner, {
    proprietarios: ['outra']
  })).toBe(false);
  expect(podeCadastrarBar({
    ...owner,
    cadastroBarAprovado: true
  })).toBe(true);
  expect(podeCadastrarBar({
    ...owner,
    papel: 'admin'
  })).toBe(true);
});
