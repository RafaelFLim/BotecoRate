// Resume a mudança para leitura/busca, sem expor Base64, URLs ou caminhos locais.
// Os valores originais permanecem nos snapshots de auditoria.
export function describeHistoryPhoto(before, after) {
  const hasPhoto = value => typeof value === 'string' && value.trim().length > 0;
  if (before === after || (!hasPhoto(before) && !hasPhoto(after))) return '';
  if (!hasPhoto(before)) return 'Foto adicionada';
  if (!hasPhoto(after)) return 'Foto removida';
  return 'Foto substituída';
}
