import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS snippets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'text',
  code TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  favorite INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS snippet_tags (
  snippet_id INTEGER NOT NULL REFERENCES snippets(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (snippet_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_snippet_tags_tag ON snippet_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_snippets_language ON snippets(language);

-- Full-text index; rowid mirrors snippets.id and is kept in sync by the repository.
CREATE VIRTUAL TABLE IF NOT EXISTS snippets_fts USING fts5(
  title, description, code, tags,
  tokenize = 'unicode61 remove_diacritics 2'
);
`;

/** Open (and migrate) a SQLite database. Use ":memory:" for tests. */
export function openDb(path = ":memory:") {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  return db;
}
