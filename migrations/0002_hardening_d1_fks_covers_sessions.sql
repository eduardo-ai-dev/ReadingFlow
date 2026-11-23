-- ReadingFlow — Migração 0002: Capas por usuário em library_items, sessões por hash + FK e índices de retenção
-- Aplicar localmente: npx wrangler d1 migrations apply readingflow-db --local
-- Aplicar em produção: npx wrangler d1 migrations apply readingflow-db --remote

-- 1. Escolha de capa e lombada por usuário em library_items (nunca acoplada a works/editions compartilhadas)
ALTER TABLE library_items ADD COLUMN cover_url TEXT;
ALTER TABLE library_items ADD COLUMN cover_source TEXT;
ALTER TABLE library_items ADD COLUMN cover_locked INTEGER NOT NULL DEFAULT 0;
ALTER TABLE library_items ADD COLUMN cover_selected_at TEXT;
ALTER TABLE library_items ADD COLUMN spine_color TEXT;
ALTER TABLE library_items ADD COLUMN spine_accent TEXT;

-- Preserva escolhas de capa existentes gravadas em editions do mesmo usuário
UPDATE library_items
SET
  cover_url = (SELECT e.cover_url FROM editions e WHERE e.id = library_items.edition_id AND e.user_id = library_items.user_id),
  cover_source = (SELECT e.cover_source FROM editions e WHERE e.id = library_items.edition_id AND e.user_id = library_items.user_id),
  cover_locked = COALESCE((SELECT e.cover_locked FROM editions e WHERE e.id = library_items.edition_id AND e.user_id = library_items.user_id), 0),
  cover_selected_at = (SELECT e.cover_selected_at FROM editions e WHERE e.id = library_items.edition_id AND e.user_id = library_items.user_id),
  spine_color = (SELECT e.cover_color FROM editions e WHERE e.id = library_items.edition_id AND e.user_id = library_items.user_id),
  spine_accent = (SELECT e.spine_accent FROM editions e WHERE e.id = library_items.edition_id AND e.user_id = library_items.user_id)
WHERE cover_url IS NULL;

-- 2. Sessões armazenando apenas token_hash (HMAC-SHA256) + expires_at + FK com ON DELETE CASCADE
DROP TABLE IF EXISTS sessions;
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- 3. Índices de integridade por usuário, lookup de capas e políticas de retenção
CREATE UNIQUE INDEX IF NOT EXISTS idx_works_id_user ON works (id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_editions_id_user ON editions (id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_shelves_id_user ON shelves (id, user_id);
CREATE INDEX IF NOT EXISTS idx_library_items_user_edition ON library_items (user_id, edition_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_secrets_user_id ON auth_secrets (user_id);
CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_updated ON auth_login_attempts (updated_at_ms);
