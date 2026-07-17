-- 星憩时刻 D1 数据库 Schema

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  alert_sensitivity TEXT DEFAULT 'normal',
  push_enabled INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS rewards (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  total_sessions INTEGER DEFAULT 0,
  streak INTEGER DEFAULT 0,
  last_date TEXT,
  unlocked_rewards TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS treehole (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS baseline (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT REFERENCES users(id),
  value INTEGER NOT NULL,
  timestamp INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_treehole_created ON treehole(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_baseline_user_ts ON baseline(user_id, timestamp DESC);
