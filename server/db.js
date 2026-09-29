const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const dir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(dir, { recursive: true });

const db = new DatabaseSync(path.join(dir, 'cv-matcher.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    pass_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS docs (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    id TEXT NOT NULL,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, kind, id)
  );
  CREATE TABLE IF NOT EXISTS usage (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day TEXT NOT NULL,
    units INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, day)
  );
`);

const now = () => new Date().toISOString();

const docs = {
  list(userId, kind) {
    return db.prepare('SELECT data FROM docs WHERE user_id = ? AND kind = ? ORDER BY updated_at DESC')
      .all(userId, kind).map((r) => JSON.parse(r.data));
  },
  get(userId, kind, id) {
    const row = db.prepare('SELECT data FROM docs WHERE user_id = ? AND kind = ? AND id = ?').get(userId, kind, id);
    return row ? JSON.parse(row.data) : null;
  },
  put(userId, kind, id, data) {
    const doc = { ...data, id, updatedAt: now() };
    db.prepare(`INSERT INTO docs (user_id, kind, id, data, updated_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (user_id, kind, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`)
      .run(userId, kind, id, JSON.stringify(doc), doc.updatedAt);
    return doc;
  },
  remove(userId, kind, id) {
    db.prepare('DELETE FROM docs WHERE user_id = ? AND kind = ? AND id = ?').run(userId, kind, id);
  },
  // Pour le planificateur d'alertes : tous les utilisateurs ayant un document donné.
  usersWith(kind, id) {
    return db.prepare('SELECT user_id, data FROM docs WHERE kind = ? AND id = ?').all(kind, id)
      .map((r) => ({ userId: r.user_id, data: JSON.parse(r.data) }));
  }
};

module.exports = { db, docs, now };
