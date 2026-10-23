// SQLite local. O cache público não contém credenciais Firebase.
export const SCHEMA_VERSION = 5;
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS ownership_requests (
 id TEXT NOT NULL, bar_id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('adicionar','substituir')),
 recipient_uid TEXT NOT NULL, replace_uid TEXT, created_by TEXT NOT NULL, reason TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('pendente','concluida','recusada','cancelada','invalidada')),
 version INTEGER NOT NULL, base_version INTEGER NOT NULL, access_epoch INTEGER NOT NULL,
 required_order TEXT NOT NULL, queue TEXT NOT NULL, accepted_count INTEGER NOT NULL,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL, deleted_at TEXT, PRIMARY KEY(bar_id,id)
);
CREATE TABLE IF NOT EXISTS ownership_votes (
 bar_id TEXT NOT NULL, request_id TEXT NOT NULL, usuario_id TEXT NOT NULL,
 decision TEXT NOT NULL CHECK(decision IN ('aceito','recusado')), PRIMARY KEY(bar_id,request_id,usuario_id), FOREIGN KEY(bar_id,request_id) REFERENCES ownership_requests(bar_id,id)
);
CREATE TABLE IF NOT EXISTS ownership_historico (
 id TEXT PRIMARY KEY, bar_id TEXT NOT NULL, request_id TEXT NOT NULL, actor_id TEXT NOT NULL,
 vote TEXT NOT NULL, before_json TEXT NOT NULL, after_json TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ownership_review_exclusions (
 bar_id TEXT NOT NULL, usuario_id TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(bar_id,usuario_id)
);
CREATE INDEX IF NOT EXISTS idx_ownership_inbox ON ownership_requests(recipient_uid,status,updated_at);
CREATE INDEX IF NOT EXISTS idx_ownership_bar ON ownership_requests(bar_id,status,updated_at);
CREATE INDEX IF NOT EXISTS idx_ownership_history ON ownership_historico(bar_id,request_id,created_at,actor_id);

CREATE TABLE IF NOT EXISTS admin_access_historico (
  id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, actor_id TEXT NOT NULL,
  reason TEXT NOT NULL, before_json TEXT NOT NULL, after_json TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS review_moderation (
  entity_type TEXT NOT NULL CHECK(entity_type IN ('avaliacoes_bares','avaliacoes_itens')),
  entity_id TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('visivel','oculta','excluida')),
  reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 5 AND 500), actor_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK(version > 0), updated_at TEXT NOT NULL, deleted_at TEXT, purge_after INTEGER,
  PRIMARY KEY(entity_type,entity_id)
);
CREATE TABLE IF NOT EXISTS review_moderation_historico (
  id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, actor_id TEXT NOT NULL,
  snapshot_json TEXT NOT NULL, created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY, usuario TEXT NOT NULL, email TEXT, origem TEXT NOT NULL DEFAULT 'firebase',
  papel TEXT NOT NULL DEFAULT 'comum' CHECK(papel IN ('comum','dono','admin')),
  status TEXT NOT NULL DEFAULT 'ativo' CHECK(status IN ('ativo','banido','excluido')),
  email_verificado INTEGER NOT NULL DEFAULT 0 CHECK(email_verificado IN (0,1)),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS contas_locais (
  id TEXT PRIMARY KEY REFERENCES usuarios(id), usuario_normalizado TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL, salt TEXT NOT NULL, iterations INTEGER NOT NULL,
  algorithm TEXT NOT NULL CHECK(algorithm='pbkdf2-sha256'), firebase_uid TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS local_login_attempts (
  account_id TEXT PRIMARY KEY REFERENCES usuarios(id), failures INTEGER NOT NULL DEFAULT 0,
  blocked_until INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS usuarios_historico (
  id TEXT PRIMARY KEY, usuario_id TEXT NOT NULL REFERENCES usuarios(id), actor_id TEXT,
  acao TEXT NOT NULL, snapshot_json TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ativacoes_conta (
  local_id TEXT PRIMARY KEY REFERENCES usuarios(id), firebase_uid TEXT NOT NULL REFERENCES usuarios(id),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bares (
  id TEXT PRIMARY KEY, nome TEXT NOT NULL, endereco TEXT NOT NULL, detalhes TEXT NOT NULL DEFAULT '', foto TEXT,
  latitude REAL, longitude REAL, criado_por TEXT, cep TEXT, origem_endereco TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, version INTEGER NOT NULL DEFAULT 1,
  CHECK((latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180))
);
CREATE TABLE IF NOT EXISTS bar_proprietarios (
  bar_id TEXT NOT NULL REFERENCES bares(id), usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT,
  PRIMARY KEY(bar_id,usuario_id)
);
CREATE TABLE IF NOT EXISTS itens_cardapio (
  id TEXT PRIMARY KEY, bar_id TEXT NOT NULL REFERENCES bares(id), tipo TEXT NOT NULL CHECK(tipo IN ('comida','bebida')),
  nome TEXT NOT NULL, descricao TEXT NOT NULL, valor_centavos INTEGER NOT NULL CHECK(typeof(valor_centavos)='integer' AND valor_centavos > 0), foto TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS avaliacoes_bares (
  id TEXT PRIMARY KEY, bar_id TEXT NOT NULL REFERENCES bares(id), autor_id TEXT REFERENCES usuarios(id), autor_nome TEXT NOT NULL,
  nota INTEGER NOT NULL CHECK(typeof(nota)='integer' AND nota BETWEEN 1 AND 5), comentario TEXT NOT NULL,
  elegivel_ranking INTEGER NOT NULL DEFAULT 1 CHECK(elegivel_ranking IN (0,1)),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS avaliacoes_itens (
  id TEXT PRIMARY KEY, item_id TEXT NOT NULL REFERENCES itens_cardapio(id), autor_id TEXT REFERENCES usuarios(id), autor_nome TEXT NOT NULL,
  nota INTEGER NOT NULL CHECK(typeof(nota)='integer' AND nota BETWEEN 1 AND 5), comentario TEXT NOT NULL,
  elegivel_ranking INTEGER NOT NULL DEFAULT 1 CHECK(elegivel_ranking IN (0,1)),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, version INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS uma_avaliacao_bar ON avaliacoes_bares(bar_id,autor_id) WHERE deleted_at IS NULL AND autor_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uma_avaliacao_item ON avaliacoes_itens(item_id,autor_id) WHERE deleted_at IS NULL AND autor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS itens_bar ON itens_cardapio(bar_id,deleted_at);
CREATE INDEX IF NOT EXISTS avaliacoes_bar ON avaliacoes_bares(bar_id,deleted_at);
CREATE INDEX IF NOT EXISTS avaliacoes_item ON avaliacoes_itens(item_id,deleted_at);
CREATE TABLE IF NOT EXISTS bares_historico (
  id TEXT PRIMARY KEY, entidade_id TEXT NOT NULL REFERENCES bares(id), actor_id TEXT, acao TEXT NOT NULL,
  snapshot_json TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS itens_cardapio_historico (
  id TEXT PRIMARY KEY, entidade_id TEXT NOT NULL REFERENCES itens_cardapio(id), actor_id TEXT, acao TEXT NOT NULL,
  snapshot_json TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS avaliacoes_bares_historico (
  id TEXT PRIMARY KEY, entidade_id TEXT NOT NULL REFERENCES avaliacoes_bares(id), actor_id TEXT, acao TEXT NOT NULL,
  snapshot_json TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS avaliacoes_itens_historico (
  id TEXT PRIMARY KEY, entidade_id TEXT NOT NULL REFERENCES avaliacoes_itens(id), actor_id TEXT, acao TEXT NOT NULL,
  snapshot_json TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sync_queue (
  operation_id TEXT PRIMARY KEY, account_uid TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
  operation TEXT NOT NULL, payload TEXT NOT NULL, base_version INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente','conflito','rejeitada')),
  attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS fila_por_conta ON sync_queue(account_uid,status,created_at);
CREATE TABLE IF NOT EXISTS sync_entities (
  entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, payload TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(entity_type,entity_id)
);
CREATE TABLE IF NOT EXISTS sync_batches (
  operation_id TEXT PRIMARY KEY, account_uid TEXT NOT NULL, queue_ids TEXT NOT NULL,
  payload TEXT NOT NULL, wire_payload TEXT, attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL DEFAULT 0, last_error TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente','conflito','rejeitada'))
);
CREATE TABLE IF NOT EXISTS sync_conflicts (
  operation_id TEXT PRIMARY KEY, account_uid TEXT NOT NULL, local_json TEXT NOT NULL,
  remote_json TEXT NOT NULL, created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_moderation_history_target ON review_moderation_historico(entity_type,entity_id,created_at);
CREATE INDEX IF NOT EXISTS idx_access_history_target ON admin_access_historico(entity_id,created_at);
CREATE VIEW IF NOT EXISTS vw_historico_moderacao AS
  SELECT h.id,h.entity_type AS tabela,h.entity_id AS registro_id,h.created_at AS data,
    COALESCE(u.usuario,h.actor_id) AS responsavel,h.actor_id AS responsavel_id,
    json_extract(h.snapshot_json,'$.before.status') AS estado_anterior,
    json_extract(h.snapshot_json,'$.record.status') AS estado_novo,
    json_extract(h.snapshot_json,'$.record.reason') AS justificativa,
    json_extract(h.snapshot_json,'$.record.version') AS versao
  FROM review_moderation_historico h LEFT JOIN usuarios u ON u.id=h.actor_id;
CREATE VIEW IF NOT EXISTS vw_historico_acessos AS
  SELECT h.id,h.entity_id AS usuario_id,h.created_at AS data,COALESCE(u.usuario,h.actor_id) AS responsavel,
    h.actor_id AS responsavel_id,h.reason AS justificativa,
    COALESCE(json_extract(h.before_json,'$.role'),'comum') AS permissao_anterior,
    json_extract(h.after_json,'$.role') AS permissao_nova,
    COALESCE(json_extract(h.before_json,'$.status'),'ativo') AS estado_anterior,
    json_extract(h.after_json,'$.status') AS estado_novo
  FROM admin_access_historico h LEFT JOIN usuarios u ON u.id=h.actor_id;
CREATE INDEX IF NOT EXISTS idx_bares_hist_busca ON bares_historico(entidade_id,created_at,actor_id);
CREATE INDEX IF NOT EXISTS idx_itens_cardapio_hist_busca ON itens_cardapio_historico(entidade_id,created_at,actor_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_bares_hist_busca ON avaliacoes_bares_historico(entidade_id,created_at,actor_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_itens_hist_busca ON avaliacoes_itens_historico(entidade_id,created_at,actor_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_hist_busca ON usuarios_historico(usuario_id,created_at,actor_id);
CREATE VIEW IF NOT EXISTS vw_historico_catalogo AS
SELECT h.id,'bares' AS tabela,h.entidade_id AS registro_id,h.created_at AS data,h.acao AS acao,COALESCE(u.usuario,h.actor_id,'Legado/sistema') AS responsavel,h.actor_id AS responsavel_id,COALESCE(json_extract(h.snapshot_json,'$.nome'),json_extract(h.snapshot_json,'$.usuario')) AS nome_anterior,json_extract(h.snapshot_json,'$.nota') AS nota_anterior,json_extract(h.snapshot_json,'$.comentario') AS comentario_anterior,json_extract(h.snapshot_json,'$.valor_centavos')/100.0 AS preco_anterior FROM bares_historico h LEFT JOIN usuarios u ON u.id=h.actor_id
UNION ALL
SELECT h.id,'itens_cardapio' AS tabela,h.entidade_id AS registro_id,h.created_at AS data,h.acao AS acao,COALESCE(u.usuario,h.actor_id,'Legado/sistema') AS responsavel,h.actor_id AS responsavel_id,COALESCE(json_extract(h.snapshot_json,'$.nome'),json_extract(h.snapshot_json,'$.usuario')) AS nome_anterior,json_extract(h.snapshot_json,'$.nota') AS nota_anterior,json_extract(h.snapshot_json,'$.comentario') AS comentario_anterior,json_extract(h.snapshot_json,'$.valor_centavos')/100.0 AS preco_anterior FROM itens_cardapio_historico h LEFT JOIN usuarios u ON u.id=h.actor_id
UNION ALL
SELECT h.id,'avaliacoes_bares' AS tabela,h.entidade_id AS registro_id,h.created_at AS data,h.acao AS acao,COALESCE(u.usuario,h.actor_id,'Legado/sistema') AS responsavel,h.actor_id AS responsavel_id,COALESCE(json_extract(h.snapshot_json,'$.nome'),json_extract(h.snapshot_json,'$.usuario')) AS nome_anterior,json_extract(h.snapshot_json,'$.nota') AS nota_anterior,json_extract(h.snapshot_json,'$.comentario') AS comentario_anterior,json_extract(h.snapshot_json,'$.valor_centavos')/100.0 AS preco_anterior FROM avaliacoes_bares_historico h LEFT JOIN usuarios u ON u.id=h.actor_id
UNION ALL
SELECT h.id,'avaliacoes_itens' AS tabela,h.entidade_id AS registro_id,h.created_at AS data,h.acao AS acao,COALESCE(u.usuario,h.actor_id,'Legado/sistema') AS responsavel,h.actor_id AS responsavel_id,COALESCE(json_extract(h.snapshot_json,'$.nome'),json_extract(h.snapshot_json,'$.usuario')) AS nome_anterior,json_extract(h.snapshot_json,'$.nota') AS nota_anterior,json_extract(h.snapshot_json,'$.comentario') AS comentario_anterior,json_extract(h.snapshot_json,'$.valor_centavos')/100.0 AS preco_anterior FROM avaliacoes_itens_historico h LEFT JOIN usuarios u ON u.id=h.actor_id
UNION ALL
SELECT h.id,'usuarios' AS tabela,h.usuario_id AS registro_id,h.created_at AS data,h.acao AS acao,COALESCE(u.usuario,h.actor_id,'Legado/sistema') AS responsavel,h.actor_id AS responsavel_id,COALESCE(json_extract(h.snapshot_json,'$.nome'),json_extract(h.snapshot_json,'$.usuario')) AS nome_anterior,json_extract(h.snapshot_json,'$.nota') AS nota_anterior,json_extract(h.snapshot_json,'$.comentario') AS comentario_anterior,json_extract(h.snapshot_json,'$.valor_centavos')/100.0 AS preco_anterior FROM usuarios_historico h LEFT JOIN usuarios u ON u.id=h.actor_id;

CREATE VIEW IF NOT EXISTS vw_historico_propriedade AS
SELECT h.id,h.bar_id,COALESCE(b.nome,h.bar_id) AS bar,h.request_id AS solicitacao_id,
 h.created_at AS data,COALESCE(u.usuario,h.actor_id) AS responsavel,h.actor_id AS responsavel_id,
 h.vote AS resposta,json_extract(h.after_json,'$.kind') AS tipo,
 json_extract(h.before_json,'$.status') AS estado_anterior,json_extract(h.after_json,'$.status') AS estado_novo,
 json_extract(h.after_json,'$.recipient_uid') AS convidado_id,json_extract(h.after_json,'$.replace_uid') AS substituido_id,
 json_extract(h.after_json,'$.accepted_count') AS total_aceites,json_extract(h.after_json,'$.reason') AS motivo
FROM ownership_historico h LEFT JOIN usuarios u ON u.id=h.actor_id LEFT JOIN bares b ON b.id=h.bar_id;
`;
