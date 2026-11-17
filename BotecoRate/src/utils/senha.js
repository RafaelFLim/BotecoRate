// Devolve a mensagem do primeiro requisito que falhar, ou null se a senha for válida.
export function validarSenha(senha) {
  if (senha.length < 8) {
    return 'A senha precisa ter no mínimo 8 caracteres.';
  }

  if (!/[A-Z]/.test(senha)) {
    return 'A senha precisa ter pelo menos uma letra maiúscula.';
  }

  const special = "^$*.[]{}()?\"!@#%&/\\,><':;|_~`";
  if (![...senha].some(character => special.includes(character))) {
    return 'A senha precisa ter pelo menos um caractere especial.';
  }

  return null;
}
