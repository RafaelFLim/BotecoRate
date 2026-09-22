// Formatação manual (sem Intl) pra não depender de locale pt-BR estar
// disponível no engine do aparelho.
export function formatarDataHora(dataIso) {
  const data = new Date(dataIso);

  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const ano = data.getFullYear();
  const hora = String(data.getHours()).padStart(2, '0');
  const minuto = String(data.getMinutes()).padStart(2, '0');

  return `${dia}/${mes}/${ano} às ${hora}:${minuto}`;
}
