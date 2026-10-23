export async function saveOwnership(tx,requests={},history={}) {
  // A projeção de solicitações é reconstruída; os eventos e exclusões do ranking são duráveis.
  await tx.runAsync('DELETE FROM ownership_votes');
  await tx.runAsync('DELETE FROM ownership_requests');
  for(const [bar,rows] of Object.entries(requests)) for(const r of Object.values(rows||{})) {
    if(!r)continue;
    await tx.runAsync('INSERT INTO ownership_requests(id,bar_id,kind,recipient_uid,replace_uid,created_by,reason,status,version,base_version,access_epoch,required_order,queue,accepted_count,created_at,updated_at,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      r.id,bar,r.kind,r.recipient_uid,r.replace_uid||null,r.created_by,r.reason,r.status,r.version,r.base_version,r.access_epoch,r.required_order,r.queue,r.accepted_count,r.created_at,r.updated_at,r.updated_by);
    for(const [uid,vote] of Object.entries(r.participants||{})) await tx.runAsync('INSERT INTO ownership_votes(bar_id,request_id,usuario_id,decision) VALUES (?,?,?,?)',bar,r.id,uid,vote);
    if(r.status==='concluida') for(const uid of r.required_order.split('|').filter(Boolean)) await tx.runAsync('INSERT OR IGNORE INTO ownership_review_exclusions(bar_id,usuario_id,created_at) VALUES (?,?,?)',bar,uid,r.updated_at);
  }
  for(const [bar,rows] of Object.entries(history)) for(const [id,versions] of Object.entries(rows||{})) for(const [version,event] of Object.entries(versions||{})) {
    if(!event)continue;
    await tx.runAsync('INSERT OR IGNORE INTO ownership_historico(id,bar_id,request_id,actor_id,vote,before_json,after_json,created_at) VALUES (?,?,?,?,?,?,?,?)',`${bar}:${id}:${version}`,bar,id,event.actor_uid,event.vote,JSON.stringify(event.before),JSON.stringify(event.record),event.record.updated_at);
  }
}
