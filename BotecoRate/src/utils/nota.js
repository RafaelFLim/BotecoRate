export function calcularNotaMedia(avaliacoes) {
  if (!avaliacoes || avaliacoes.length === 0) {
    return 0;
  }

  const soma = avaliacoes.reduce((total, avaliacao) => total + avaliacao.nota, 0);
  return soma / avaliacoes.length;
}
