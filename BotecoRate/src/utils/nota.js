export function avaliacaoContaNoRanking(avaliacao, proprietarios = []) {
  return avaliacao.elegivelRanking !== false && !avaliacao.deleted_at && !(avaliacao.autorId && proprietarios.includes(avaliacao.autorId));
}

export function calcularNotaMedia(avaliacoes, proprietarios = []) {
  const elegiveis = (avaliacoes || []).filter(avaliacao => avaliacaoContaNoRanking(avaliacao, proprietarios));
  if (elegiveis.length === 0) {
    return 0;
  }

  const soma = elegiveis.reduce((total, avaliacao) => total + avaliacao.nota, 0);
  return soma / elegiveis.length;
}
