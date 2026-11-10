export function hasEligibleOwner(direct, accounts, barId) {
  return Object.entries(direct.owners?.[barId] || {}).some(([uid, owner]) => {
    const account = accounts[uid];
    return owner === true && account?.status === 'ativo' && ['dono', 'admin'].includes(account.role);
  });
}

export function planCustody(direct, accounts, { barId, actor, active, reason, now }) {
  const bar = direct.entities?.bares?.[barId];
  if (!bar || bar.deleted_at) throw new Error('O bar precisa estar ativo para alterar a custódia.');
  const previous = direct.custody?.[barId];
  if ((previous?.active ?? false) === active) throw new Error('A custódia já está neste estado.');
  if (hasEligibleOwner(direct, accounts, barId) === active) {
    throw new Error(active ? 'O bar ainda tem um dono elegível.' : 'O bar ainda não tem um dono elegível.');
  }
  const justification = reason.trim();
  if (justification.length < 5 || justification.length > 500) throw new Error('Informe uma justificativa entre 5 e 500 caracteres.');
  const record = { active, version: (previous?.version ?? 0) + 1, updated_at: now, updated_by: actor, reason: justification,
    access_epoch: direct.ownership_epoch ?? 0, ownership_version: direct.ownership_state?.[barId]?.version ?? 0 };
  return { [`custody/${barId}`]: record, [`custody_history/${barId}/${record.version}`]: record };
}
