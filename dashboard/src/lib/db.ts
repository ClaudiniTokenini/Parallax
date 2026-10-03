import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Database from "better-sqlite3";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "parallax.db");
const SCHEMA_PATH = path.join(process.cwd(), "schema.sql");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(fs.readFileSync(SCHEMA_PATH, "utf8"));
  migrateSchema(db);
  return db;
}

function tableColumns(database: Database.Database, table: string): Set<string> {
  return new Set(
    (database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map(
      (column) => column.name
    )
  );
}

function tableExists(database: Database.Database, table: string): boolean {
  const row = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table) as { name: string } | undefined;
  return Boolean(row);
}

function ensureSoloUserId(database: Database.Database): string {
  const existing = database.prepare("SELECT id FROM users ORDER BY created_at LIMIT 1").get() as
    | { id: string }
    | undefined;
  if (existing) return existing.id;

  const id = crypto.randomUUID();
  const token = `plx_${crypto.randomBytes(16).toString("hex")}`;
  database
    .prepare(
      `INSERT INTO users (id, display_name, pairing_token, created_at)
       VALUES (?, 'You', ?, ?)`
    )
    .run(id, token, new Date().toISOString());
  return id;
}

function addUserIdColumn(database: Database.Database, table: string, userId: string): void {
  if (!tableExists(database, table)) return;
  const columns = tableColumns(database, table);
  if (!columns.has("user_id")) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN user_id TEXT`);
  }
  database.prepare(`UPDATE ${table} SET user_id = ? WHERE user_id IS NULL OR user_id = ''`).run(userId);
}

function rebuildPostEvents(database: Database.Database, userId: string): void {
  if (!tableExists(database, "post_events")) return;
  if (tableColumns(database, "post_events").has("user_id")) return;

  database.exec(`
    CREATE TABLE post_events_v2 (
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
  `);
  database
    .prepare(
      `INSERT INTO post_events_v2
        (id, user_id, occurred_at, platform, post_id, event_type, is_negative, created_at)
       SELECT id, ?, occurred_at, platform, post_id, event_type, is_negative, created_at
       FROM post_events`
    )
    .run(userId);
  database.exec(`
    DROP TABLE post_events;
    ALTER TABLE post_events_v2 RENAME TO post_events;
    CREATE INDEX IF NOT EXISTS idx_post_events_occurred_at ON post_events (occurred_at);
    CREATE INDEX IF NOT EXISTS idx_post_events_user_occurred ON post_events (user_id, occurred_at);
    CREATE INDEX IF NOT EXISTS idx_post_events_type_occurred ON post_events (event_type, occurred_at);
  `);
}

function rebuildMentalDaily(database: Database.Database): void {
  if (!tableExists(database, "mental_daily") || !tableExists(database, "post_events")) return;
  const events = (
    database.prepare("SELECT COUNT(*) AS count FROM post_events").get() as { count: number }
  ).count;
  const days = (
    database.prepare("SELECT COUNT(*) AS count FROM mental_daily").get() as { count: number }
  ).count;
  if (!events || days) return;

  const rows = database
    .prepare(
      `SELECT user_id, occurred_at, platform, event_type, is_negative
       FROM post_events`
    )
    .all() as Array<{
    user_id: string;
    occurred_at: string;
    platform: string;
    event_type: string;
    is_negative: number | null;
  }>;

  const increment = database.prepare(
    `INSERT INTO mental_daily
      (user_id, date, platform, classified, negative, hidden, revealed)
     VALUES (@userId, @date, @platform, @classified, @negative, @hidden, @revealed)
     ON CONFLICT(user_id, date, platform) DO UPDATE SET
       classified = classified + excluded.classified,
       negative = negative + excluded.negative,
       hidden = hidden + excluded.hidden,
       revealed = revealed + excluded.revealed`
  );

  const tx = database.transaction(() => {
    for (const row of rows) {
      const date = localDateFromIso(row.occurred_at);
      increment.run({
        userId: row.user_id,
        date,
        platform: row.platform,
        classified: row.event_type === "classified" ? 1 : 0,
        negative: row.event_type === "classified" && row.is_negative === 1 ? 1 : 0,
        hidden: row.event_type === "hidden" ? 1 : 0,
        revealed: row.event_type === "revealed" ? 1 : 0
      });
    }
  });
  tx();
}

function localDateFromIso(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso).slice(0, 10);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function migrateSchema(database: Database.Database): void {
  const extraColumns: Record<string, Array<[string, string]>> = {
    sleep_nights: [
      ["score", "REAL"],
      ["rem_seconds", "INTEGER"],
      ["deep_seconds", "INTEGER"],
      ["light_seconds", "INTEGER"],
      ["efficiency_percent", "REAL"]
    ],
    exercises: [
      ["hr_avg", "INTEGER"],
      ["hr_max", "INTEGER"],
      ["cardio_load_label", "TEXT"],
      ["distance_meters", "REAL"],
      ["name", "TEXT"],
      ["hr_cap", "INTEGER"],
      ["zone_low_seconds", "INTEGER"],
      ["zone_mid_seconds", "INTEGER"],
      ["zone_high_seconds", "INTEGER"]
    ]
  };

  for (const [table, additions] of Object.entries(extraColumns)) {
    if (!tableExists(database, table)) continue;
    const existing = tableColumns(database, table);
    for (const [name, definition] of additions) {
      if (!existing.has(name)) {
        database.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
      }
    }
  }

  const userId = ensureSoloUserId(database);
  rebuildPostEvents(database, userId);
  for (const table of ["sleep_nights", "exercises", "daily_activity", "recharge_nights", "post_events"]) {
    addUserIdColumn(database, table, userId);
  }
  database.exec(
    "CREATE INDEX IF NOT EXISTS idx_post_events_user_occurred ON post_events (user_id, occurred_at)"
  );
  rebuildMentalDaily(database);
}

export function getDbPath(): string {
  return DB_PATH;
}

export function closeDb(): void {
  db?.close();
  db = null;
}

const WIPE_TABLES = [
  "post_events",
  "mental_daily",
  "sleep_nights",
  "exercises",
  "daily_activity",
  "recharge_nights",
  "polar_accounts",
  "meta"
];

export function wipeDb(): void {
  const database = getDb();
  database.transaction(() => {
    for (const table of WIPE_TABLES) {
      if (!tableExists(database, table)) continue;
      database.prepare(`DELETE FROM ${table}`).run();
    }
    const sequences = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sqlite_sequence'")
      .get();
    if (sequences) database.exec("DELETE FROM sqlite_sequence");
  })();
  database.pragma("wal_checkpoint(TRUNCATE)");
}

export function deleteDbFile(): void {
  wipeDb();
  closeDb();
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    const filePath = `${DB_PATH}${suffix}`;
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // Windows keeps the file locked while Next.js holds another handle.
      }
    }
  }
}

export function getMeta(key: string): string | null {
  const row = getDb()
    .prepare("SELECT value FROM meta WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setMeta(key: string, value: string): void {
  getDb()
    .prepare(
      `INSERT INTO meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .run(key, value);
}
