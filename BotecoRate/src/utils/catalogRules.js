import { podeAvaliar, podeCadastrarBar, podeGerenciarBar, exigirInteracao } from './permissoes.js';
import { validateBarData } from './barManagement.js';

const same = (a, b, fields) => fields.every((field) => a?.[field] === b?.[field]);
const barFields = ['nome', 'endereco', 'detalhes', 'foto', 'latitude', 'longitude'];
const itemFields = ['tipo', 'nome', 'descricao', 'valor', 'foto'];
const reviewFields = ['nota', 'comentario', 'autorId', 'autor', 'elegivelRanking'];

function validateReviews(before, after, user, bar) {
  if (new Set(after.map((r) => r.id)).size !== after.length) throw new Error('Avaliação duplicada.');
  for (const r of after) {
    const old = before.find((v) => v.id === r.id);
    if (old && same(old, r, reviewFields)) continue;
    if (old && r.elegivelRanking !== old.elegivelRanking) throw new Error('Elegibilidade do ranking é controlada pela administração.');
    if (!podeAvaliar(user, bar)) throw new Error('Donos não podem avaliar seu próprio bar ou cardápio.');
    if ((old && old.autorId !== user.id) || r.autorId !== user.id) throw new Error('Você só pode editar sua própria avaliação.');
    if (!old && r.autor !== user.usuario) throw new Error('Autor da avaliação inválido.');
    if (!Number.isInteger(r.nota) || r.nota < 1 || r.nota > 5) throw new Error('Nota deve ser de 1 a 5.');
    if (!old && after.filter((v) => v.autorId === user.id).length > 1) throw new Error('Você já avaliou este estabelecimento ou item.');
  }
  for (const old of before) if (!after.some((r) => r.id === old.id) && old.autorId !== user.id) {
    throw new Error('A moderação exige painel administrativo e justificativa.');
  }
}

export function validateCatalogChange(before, after, user) {
  exigirInteracao(user);
  if (new Set(after.map((b) => b.id)).size !== after.length) throw new Error('Bar duplicado.');
  for (const bar of after) {
    const old = before.find((b) => b.id === bar.id);
    const manager = old ? podeGerenciarBar(user, old) : podeCadastrarBar(user);
    if ((!old || !same(old, bar, barFields)) && !manager) throw new Error('Somente donos e admins podem alterar este bar.');
    if (!old || !same(old, bar, barFields)) validateBarData(bar);
    if (old && JSON.stringify([...(old.proprietarios || [])].sort()) !== JSON.stringify([...(bar.proprietarios || [])].sort())) throw new Error('Vínculos de propriedade só podem ser alterados pelo fluxo autorizado no servidor.');
    if (!old || JSON.stringify((old.cardapio || []).map((i) => i.id).sort()) !== JSON.stringify((bar.cardapio || []).map((i) => i.id).sort())) {
      if (!manager) throw new Error('Você não pode alterar este cardápio.');
      if (bar.cardapio.length < 3) throw new Error('O bar precisa manter pelo menos três itens no cardápio.');
    }
    validateReviews(old?.avaliacoes || [], bar.avaliacoes || [], user, old || bar);
    for (const item of bar.cardapio || []) {
      const oldItem = old?.cardapio?.find((i) => i.id === item.id);
      if (!oldItem || !same(oldItem, item, itemFields)) {
        if (!manager) throw new Error('Somente donos e admins podem alterar itens.');
        if (!item.nome?.trim() || !item.descricao?.trim() || !['comida', 'bebida'].includes(item.tipo) || !Number.isFinite(item.valor) || item.valor <= 0) throw new Error('Preencha corretamente o item.');
      }
      validateReviews(oldItem?.avaliacoes || [], item.avaliacoes || [], user, old || bar);
    }
  }
  for (const old of before) if (!after.some((bar) => bar.id === old.id) && !podeGerenciarBar(user, old)) throw new Error('Você não pode excluir este bar.');
}
