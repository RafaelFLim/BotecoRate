// Devolve a mensagem do primeiro requisito que falhar, ou null se a senha for válida.
export function validarSenha(senha) {
  if (senha.length < 8) {
    return 'A senha precisa ter no mínimo 8 caracteres.';
  }

  if (!/[A-Z]/.test(senha)) {
    return 'A senha precisa ter pelo menos uma letra maiúscula.';
  }

  if (!/[^A-Za-z0-9]/.test(senha)) {
    return 'A senha precisa ter pelo menos um caractere especial.';
  }

  return null;
}
