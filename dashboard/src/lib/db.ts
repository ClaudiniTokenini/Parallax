import fs from "node:fs";
import path from "node:path";
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

function migrateSchema(database: Database.Database): void {
  const columns: Record<string, Array<[string, string]>> = {
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

  for (const [table, additions] of Object.entries(columns)) {
    const existing = new Set(
      (database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map(
        (column) => column.name
      )
    );
    for (const [name, definition] of additions) {
      if (!existing.has(name)) {
        database.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
      }
    }
  }
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
    if (!fs.existsSync(filePath)) continue;
    try {
      fs.unlinkSync(filePath);
    } catch {
      // Windows keeps the file locked while Next.js holds another handle.
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
