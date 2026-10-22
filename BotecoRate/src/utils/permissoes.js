export function podeInteragir(user) {
  return Boolean(user && user.origem === 'firebase' && user.emailVerificado && user.status === 'ativo');
}
export function podeCadastrarBar(user) {
  return podeInteragir(user) && ['dono', 'admin'].includes(user.papel);
}
export function podeGerenciarBar(user, bar) {
  return podeInteragir(user) && (user.papel === 'admin' || (user.papel === 'dono' && (bar.proprietarios || []).includes(user.id)));
}
export function podeAvaliar(user, bar) {
  return podeInteragir(user) && !(bar.proprietarios || []).includes(user.id);
}
export function exigirInteracao(user) {
  if (!podeInteragir(user)) throw new Error('Entre com uma conta ativa e e-mail verificado para fazer alterações.');
}
