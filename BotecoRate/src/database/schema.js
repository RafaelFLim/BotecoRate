// Versão 1: banco local. O cache público não contém credenciais Firebase.
export const SCHEMA_VERSION = 1;
export const SCHEMA_SQL = `
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
`;
