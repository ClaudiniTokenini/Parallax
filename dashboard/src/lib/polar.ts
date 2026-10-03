import { getDb, setMeta } from "./db";
import { toIso } from "./dates";

const POLAR_AUTH = "https://flow.polar.com/oauth2/authorization";
const POLAR_TOKEN = "https://polarremote.com/v2/oauth2/token";
const POLAR_API = "https://www.polaraccesslink.com";

export function polarConfigured(): boolean {
  return Boolean(process.env.POLAR_CLIENT_ID && process.env.POLAR_CLIENT_SECRET);
}

export function polarRedirectUri(): string {
  return process.env.POLAR_REDIRECT_URI || "http://127.0.0.1:3000/api/polar/callback";
}

export function polarAuthUrl(): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.POLAR_CLIENT_ID || "",
    redirect_uri: polarRedirectUri(),
    scope: "accesslink.read_all"
  });
  return `${POLAR_AUTH}?${params.toString()}`;
}

function basicAuth(): string {
  const raw = `${process.env.POLAR_CLIENT_ID}:${process.env.POLAR_CLIENT_SECRET}`;
  return `Basic ${Buffer.from(raw).toString("base64")}`;
}

async function polarFetch(path: string, token: string): Promise<unknown> {
  const response = await fetch(`${POLAR_API}${path}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`
    },
    cache: "no-store"
  });
  if (response.status === 204) return null;
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Polar ${path} failed (${response.status}): ${details.slice(0, 240)}`);
  }
  return response.json();
}

export async function exchangePolarCode(code: string): Promise<{ userId: string; accessToken: string }> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: polarRedirectUri()
  });

  const response = await fetch(POLAR_TOKEN, {
    method: "POST",
    headers: {
      Authorization: basicAuth(),
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body,
    cache: "no-store"
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Polar token exchange failed (${response.status}): ${details.slice(0, 240)}`);
  }

  const payload = (await response.json()) as {
    access_token?: string;
    x_user_id?: string | number;
  };
  const accessToken = String(payload.access_token || "");
  const userId = String(payload.x_user_id || "");
  if (!accessToken || !userId) throw new Error("Polar token response missing access_token or x_user_id");

  const register = await fetch(`${POLAR_API}/v3/users`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ "member-id": userId }),
    cache: "no-store"
  });

  if (!register.ok && register.status !== 409) {
    const details = await register.text();
    throw new Error(`Polar user register failed (${register.status}): ${details.slice(0, 240)}`);
  }

  const db = getDb();
  db.prepare("DELETE FROM polar_accounts").run();
  db.prepare(
    `INSERT INTO polar_accounts (user_id, access_token, connected_at)
     VALUES (?, ?, ?)`
  ).run(userId, accessToken, toIso());

  return { userId, accessToken };
}

function asArray(value: unknown, keys: string[]): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of keys) {
      if (Array.isArray(record[key])) return record[key] as unknown[];
    }
  }
  return [];
}

function pickString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    if (record[key] != null && String(record[key]).trim()) return String(record[key]);
  }
  return null;
}

function pickNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const parsed = parseDuration(record[key]);
    if (parsed != null) return parsed;
  }
  return null;
}

export function parseDuration(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 100000 ? Math.round(value / 1e9) : value;
  }
  if (typeof value !== "string" || !value.trim()) return null;
  const iso = value.trim().match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/i);
  if (iso) {
    return (
      Number(iso[1] || 0) * 3600 + Number(iso[2] || 0) * 60 + Number(iso[3] || 0)
    );
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export async function syncPolarData(): Promise<{
  exercises: number;
  sleep: number;
  recharge: number;
}> {
  const account = getDb()
    .prepare("SELECT user_id, access_token FROM polar_accounts LIMIT 1")
    .get() as { user_id: string; access_token: string } | undefined;

  if (!account) throw new Error("No Polar account connected");

  const [exercisesRaw, sleepRaw, rechargeRaw] = await Promise.all([
    polarFetch("/v3/exercises", account.access_token).catch(() => []),
    polarFetch("/v3/users/sleep", account.access_token).catch(() => []),
    polarFetch("/v3/users/nightly-recharge", account.access_token).catch(() => [])
  ]);

  const db = getDb();
  const insertExercise = db.prepare(
    `INSERT OR REPLACE INTO exercises
      (polar_id, start_time, duration_seconds, sport, calories, cardio_load, source)
     VALUES (?, ?, ?, ?, ?, ?, 'polar')`
  );
  const insertSleep = db.prepare(
    `INSERT OR REPLACE INTO sleep_nights
      (date, duration_seconds, sleep_start, sleep_end, source)
     VALUES (?, ?, ?, ?, 'polar')`
  );
  const insertRecharge = db.prepare(
    `INSERT OR REPLACE INTO recharge_nights
      (date, ans_charge, status, source)
     VALUES (?, ?, ?, 'polar')`
  );

  db.prepare("DELETE FROM exercises WHERE source = 'fixture'").run();
  db.prepare("DELETE FROM sleep_nights WHERE source = 'fixture'").run();
  db.prepare("DELETE FROM recharge_nights WHERE source = 'fixture'").run();

  let exercises = 0;
  for (const item of asArray(exercisesRaw, ["exercises"])) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const id =
      pickString(record, ["id", "exercise-id", "exerciseId", "upload-time"]) ||
      pickString(record, ["start_time", "start-time"]);
    const start = pickString(record, ["start_time", "start-time"]);
    const duration = pickNumber(record, ["duration", "duration_seconds"]);
    if (!id || !start) continue;
    const durationSeconds = duration && duration > 1000 ? Math.round(duration / 1e9) || duration : duration;
    insertExercise.run(
      id,
      start,
      Math.round(durationSeconds || 0),
      pickString(record, ["sport", "detailed-sport-info"]),
      pickNumber(record, ["calories"]),
      pickNumber(record, ["cardio-load", "cardio_load"])
    );
    exercises += 1;
  }

  let sleep = 0;
  for (const item of asArray(sleepRaw, ["nights", "sleep"])) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const date = pickString(record, ["date", "night"]);
    const seconds = pickNumber(record, [
      "sleep_duration_seconds",
      "duration_seconds",
      "duration",
      "total_sleep_time"
    ]);
    if (!date || seconds == null) continue;
    const durationSeconds = seconds > 100000 ? Math.round(seconds / 1e9) : seconds;
    insertSleep.run(
      date,
      Math.round(durationSeconds),
      pickString(record, ["sleep_start_time", "sleepStartTime"]),
      pickString(record, ["sleep_end_time", "sleepEndTime"])
    );
    sleep += 1;
  }

  let recharge = 0;
  for (const item of asArray(rechargeRaw, ["recharges", "nights"])) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const date = pickString(record, ["date", "night"]);
    if (!date) continue;
    insertRecharge.run(
      date,
      pickNumber(record, ["ans_charge", "ansCharge"]),
      pickString(record, ["nightly_recharge_status", "status"])
    );
    recharge += 1;
  }

  setMeta("last_polar_sync", toIso());
  setMeta("data_source", "live");

  return { exercises, sleep, recharge };
}
