CREATE TABLE IF NOT EXISTS post_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_at TEXT NOT NULL,
  platform TEXT NOT NULL,
  post_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  is_negative INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (post_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_post_events_occurred_at
  ON post_events (occurred_at);

CREATE INDEX IF NOT EXISTS idx_post_events_type_occurred
  ON post_events (event_type, occurred_at);

CREATE TABLE IF NOT EXISTS sleep_nights (
  date TEXT PRIMARY KEY,
  duration_seconds INTEGER NOT NULL,
  sleep_start TEXT,
  sleep_end TEXT,
  source TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS exercises (
  polar_id TEXT PRIMARY KEY,
  start_time TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  sport TEXT,
  calories INTEGER,
  cardio_load REAL,
  source TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_exercises_start_time
  ON exercises (start_time);

CREATE TABLE IF NOT EXISTS recharge_nights (
  date TEXT PRIMARY KEY,
  ans_charge REAL,
  status TEXT,
  source TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS polar_accounts (
  user_id TEXT PRIMARY KEY,
  access_token TEXT NOT NULL,
  connected_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
