-- We Are Still Here | Baqoun - Cloudflare D1 schema (SQLite)
-- Apply:  npm run db:migrate:local   |   npm run db:migrate:remote

PRAGMA foreign_keys = ON;

CREATE TABLE contact_messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 120),
  email       TEXT NOT NULL CHECK (length(email) BETWEEN 5 AND 254),
  subject     TEXT CHECK (subject IS NULL OR length(subject) <= 200),
  message     TEXT NOT NULL CHECK (length(message) BETWEEN 10 AND 5000),
  lang        TEXT NOT NULL DEFAULT 'en' CHECK (lang IN ('ar', 'en')),
  status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied', 'archived')),
  ip_hash     TEXT,
  user_agent  TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_contact_created ON contact_messages (created_at DESC);
CREATE INDEX idx_contact_status ON contact_messages (status);

CREATE TABLE subscribers (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  email            TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK (length(email) BETWEEN 5 AND 254),
  name             TEXT CHECK (name IS NULL OR length(name) <= 120),
  lang             TEXT NOT NULL DEFAULT 'en' CHECK (lang IN ('ar', 'en')),
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'unsubscribed')),
  confirm_token    TEXT NOT NULL,
  unsub_token      TEXT NOT NULL UNIQUE,
  source           TEXT NOT NULL DEFAULT 'website',
  ip_hash          TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  confirm_sent_at  TEXT,
  confirmed_at     TEXT,
  unsubscribed_at  TEXT
);
CREATE INDEX idx_subscribers_status ON subscribers (status);
CREATE INDEX idx_subscribers_confirm ON subscribers (confirm_token);

CREATE TABLE news_posts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title_ar      TEXT NOT NULL CHECK (length(title_ar) BETWEEN 3 AND 200),
  title_en      TEXT NOT NULL CHECK (length(title_en) BETWEEN 3 AND 200),
  body_ar       TEXT NOT NULL CHECK (length(body_ar) BETWEEN 1 AND 20000),
  body_en       TEXT NOT NULL CHECK (length(body_en) BETWEEN 1 AND 20000),
  category      TEXT NOT NULL DEFAULT 'news' CHECK (category IN ('news', 'update', 'event')),
  event_date    TEXT CHECK (event_date IS NULL OR event_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  location      TEXT CHECK (location IS NULL OR length(location) <= 200),
  published     INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
  published_at  TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_news_published ON news_posts (published, published_at DESC, created_at DESC);

CREATE TABLE admins (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  email          TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash  TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_login_at  TEXT
);

-- Only the SHA-256 of the session token is stored; the raw token lives in the cookie.
CREATE TABLE sessions (
  token_hash  TEXT PRIMARY KEY,
  admin_id    INTEGER NOT NULL REFERENCES admins (id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX idx_sessions_expires ON sessions (expires_at);

CREATE TABLE rate_limits (
  key           TEXT PRIMARY KEY,
  window_start  INTEGER NOT NULL,
  count         INTEGER NOT NULL
);

CREATE TABLE campaigns (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  subject       TEXT NOT NULL,
  body          TEXT NOT NULL,
  sent_count    INTEGER NOT NULL DEFAULT 0,
  failed_count  INTEGER NOT NULL DEFAULT 0,
  created_by    TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
