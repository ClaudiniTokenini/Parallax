CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  username TEXT UNIQUE,
  password_hash TEXT,
  pairing_token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  last_extension_event TEXT,
  last_health_import TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS post_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  platform TEXT NOT NULL,
  post_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  is_negative INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_id, post_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_post_events_occurred_at
  ON post_events (occurred_at);

CREATE INDEX IF NOT EXISTS idx_post_events_type_occurred
  ON post_events (event_type, occurred_at);

CREATE TABLE IF NOT EXISTS mental_daily (
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  platform TEXT NOT NULL,
  classified INTEGER NOT NULL DEFAULT 0,
  negative INTEGER NOT NULL DEFAULT 0,
  hidden INTEGER NOT NULL DEFAULT 0,
  revealed INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date, platform)
);

CREATE TABLE IF NOT EXISTS sleep_nights (
  date TEXT NOT NULL,
  user_id TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  sleep_start TEXT,
  sleep_end TEXT,
  source TEXT NOT NULL,
  score REAL,
  rem_seconds INTEGER,
  deep_seconds INTEGER,
  light_seconds INTEGER,
  efficiency_percent REAL,
  PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS exercises (
  polar_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  start_time TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  sport TEXT,
  calories INTEGER,
  cardio_load REAL,
  source TEXT NOT NULL,
  hr_avg INTEGER,
  hr_max INTEGER,
  cardio_load_label TEXT,
  distance_meters REAL,
  name TEXT,
  hr_cap INTEGER,
  zone_low_seconds INTEGER,
  zone_mid_seconds INTEGER,
  zone_high_seconds INTEGER,
  PRIMARY KEY (user_id, polar_id)
);

CREATE TABLE IF NOT EXISTS daily_activity (
  date TEXT NOT NULL,
  user_id TEXT NOT NULL,
  step_count INTEGER NOT NULL,
  steps_distance REAL,
  calories INTEGER,
  source TEXT NOT NULL,
  PRIMARY KEY (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_exercises_start_time
  ON exercises (start_time);

CREATE TABLE IF NOT EXISTS recharge_nights (
  date TEXT NOT NULL,
  user_id TEXT NOT NULL,
  ans_charge REAL,
  status TEXT,
  source TEXT NOT NULL,
  PRIMARY KEY (user_id, date)
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
