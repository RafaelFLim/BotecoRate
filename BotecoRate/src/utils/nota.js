export function calcularNotaMedia(avaliacoes) {
  const elegiveis = (avaliacoes || []).filter((a) => a.elegivelRanking !== false && !a.deleted_at);
  if (elegiveis.length === 0) {
    return 0;
  }

  const soma = elegiveis.reduce((total, avaliacao) => total + avaliacao.nota, 0);
  return soma / elegiveis.length;
}
