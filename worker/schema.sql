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

-- 事件记录表：记录用户触发的关键事件（如报警、奖励解锁等）
CREATE TABLE IF NOT EXISTS event_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  detail TEXT,
  timestamp INTEGER NOT NULL
);

-- 看护报告表：按日聚合的看护摘要
CREATE TABLE IF NOT EXISTS care_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  date TEXT NOT NULL,
  avg_index REAL NOT NULL,
  behavior_counts TEXT NOT NULL DEFAULT '{}',
  relax_minutes INTEGER NOT NULL DEFAULT 0,
  timestamp INTEGER NOT NULL
);

-- 喘息时长表：每次喘息会话的时长记录
CREATE TABLE IF NOT EXISTS relax_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  timestamp INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_event_log_user_ts ON event_log(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_care_reports_user_ts ON care_reports(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_relax_sessions_user_ts ON relax_sessions(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_treehole_created_at ON treehole(created_at);
CREATE INDEX IF NOT EXISTS idx_baseline_ts ON baseline(timestamp);
