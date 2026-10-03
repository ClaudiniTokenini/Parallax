import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { getDb } from "./db";
import { toIso } from "./dates";

export const SESSION_COOKIE = "parallax_sid";

const USER_COLUMNS =
  "id, display_name, username, password_hash, pairing_token, last_extension_event, last_health_import";

export type LocalUser = {
  id: string;
  displayName: string;
  username: string | null;
  hasPassword: boolean;
  pairingToken: string;
  lastExtensionEvent: string | null;
  lastHealthImport: string | null;
};

type UserRow = {
  id: string;
  display_name: string;
  username: string | null;
  password_hash: string | null;
  pairing_token: string;
  last_extension_event: string | null;
  last_health_import: string | null;
};

function mapUser(row: UserRow): LocalUser {
  return {
    id: row.id,
    displayName: row.display_name,
    username: row.username,
    hasPassword: Boolean(row.password_hash),
    pairingToken: row.pairing_token,
    lastExtensionEvent: row.last_extension_event,
    lastHealthImport: row.last_health_import
  };
}

export function normalizeUsername(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

export function validateUsername(value: string): string {
  const username = normalizeUsername(value);
  if (username.length < 3 || username.length > 20) {
    throw new Error("Username must be 3–20 letters, numbers, or underscores.");
  }
  return username;
}

export function validatePassword(value: string): string {
  const password = String(value || "");
  if (password.length < 6) throw new Error("Password must be at least 6 characters.");
  if (password.length > 72) throw new Error("Password is too long.");
  return password;
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 32).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [scheme, salt, hash] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const next = crypto.scryptSync(password, salt, 32);
  const prev = Buffer.from(hash, "hex");
  if (next.length !== prev.length) return false;
  return crypto.timingSafeEqual(next, prev);
}

function rowById(userId: string): UserRow | undefined {
  return getDb()
    .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`)
    .get(userId) as UserRow | undefined;
}

export function getUserById(userId: string): LocalUser | null {
  const row = rowById(userId);
  return row ? mapUser(row) : null;
}

export function getUserByUsername(username: string): LocalUser | null {
  const row = getDb()
    .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE username = ?`)
    .get(normalizeUsername(username)) as UserRow | undefined;
  return row ? mapUser(row) : null;
}

export function countUsers(): number {
  return (getDb().prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number }).count;
}

export function getSoloUser(): LocalUser {
  const rows = getDb()
    .prepare(`SELECT ${USER_COLUMNS} FROM users ORDER BY created_at`)
    .all() as UserRow[];
  if (rows.length !== 1) {
    throw new Error("Signed-in user required.");
  }
  return mapUser(rows[0]);
}

function bindSession(sessionId: string, userId: string): void {
  const now = toIso();
  getDb()
    .prepare(
      `INSERT INTO sessions (id, user_id, created_at, last_seen_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET user_id = excluded.user_id, last_seen_at = excluded.last_seen_at`
    )
    .run(sessionId, userId, now, now);
}

export function attachSession(sessionId: string, userId: string): void {
  bindSession(sessionId, userId);
}

export function clearSession(sessionId: string): void {
  getDb().prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
}

export function userFromSession(sessionId: string | null): LocalUser | null {
  if (!sessionId) return null;
  const row = getDb()
    .prepare(
      `SELECT u.id, u.display_name, u.username, u.password_hash, u.pairing_token,
              u.last_extension_event, u.last_health_import
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`
    )
    .get(sessionId) as UserRow | undefined;
  if (!row) return null;
  getDb().prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?").run(toIso(), sessionId);
  return mapUser(row);
}

async function cookieJar() {
  const { cookies } = await import("next/headers");
  return cookies();
}

export async function getSessionId(): Promise<string | null> {
  try {
    const jar = await cookieJar();
    return jar.get(SESSION_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<LocalUser | null> {
  try {
    return userFromSession(await getSessionId());
  } catch {
    return null;
  }
}

export async function getRequestUser(): Promise<LocalUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 400
};

export async function loginWithPassword(username: string, password: string): Promise<LocalUser> {
  const normalized = validateUsername(username);
  const secret = validatePassword(password);
  const row = getDb()
    .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE username = ?`)
    .get(normalized) as UserRow | undefined;
  if (!row || !verifyPassword(secret, row.password_hash)) {
    throw new Error("Wrong username or password.");
  }
  return mapUser(row);
}

export async function registerWithPassword(
  username: string,
  password: string,
  displayName?: string
): Promise<LocalUser> {
  const normalized = validateUsername(username);
  const secret = validatePassword(password);
  if (getUserByUsername(normalized)) throw new Error("That username is taken.");
  const name = String(displayName || normalized).trim().slice(0, 40) || normalized;
  const id = crypto.randomUUID();
  getDb()
    .prepare(
      `INSERT INTO users (id, display_name, username, password_hash, pairing_token, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      name,
      normalized,
      hashPassword(secret),
      `plx_${crypto.randomBytes(16).toString("hex")}`,
      toIso()
    );
  return getUserById(id) as LocalUser;
}

export async function setAccountCredentials(
  userId: string,
  username: string,
  password: string
): Promise<LocalUser> {
  const normalized = validateUsername(username);
  const secret = validatePassword(password);
  const taken = getDb()
    .prepare("SELECT id FROM users WHERE username = ? AND id != ?")
    .get(normalized, userId) as { id: string } | undefined;
  if (taken) throw new Error("That username is taken.");
  getDb()
    .prepare("UPDATE users SET username = ?, password_hash = ? WHERE id = ?")
    .run(normalized, hashPassword(secret), userId);
  return getUserById(userId) as LocalUser;
}

export async function logoutCurrentSession(): Promise<void> {
  const sessionId = await getSessionId();
  if (sessionId) clearSession(sessionId);
}

function readToken(request: Request, extra?: string | null): string {
  const authorization = request.headers.get("authorization") || "";
  if (authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }
  const header = (request.headers.get("x-parallax-token") || "").trim();
  if (header) return header;
  try {
    const fromQuery = new URL(request.url).searchParams.get("token");
    if (fromQuery?.trim()) return fromQuery.trim();
  } catch {
    // ignore invalid URLs
  }
  return String(extra || "").trim();
}

export function userFromDeviceRequest(
  request: Request,
  extraToken?: string | null
): { user: LocalUser | null; invalidToken: boolean; needsPairing: boolean } {
  const token = readToken(request, extraToken);
  if (!token) return { user: null, invalidToken: false, needsPairing: true };
  const row = getDb()
    .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE pairing_token = ?`)
    .get(token) as UserRow | undefined;
  return row
    ? { user: mapUser(row), invalidToken: false, needsPairing: false }
    : { user: null, invalidToken: true, needsPairing: false };
}

export function renameUser(userId: string, displayName: string): LocalUser {
  const name = displayName.trim().slice(0, 40) || "You";
  getDb().prepare("UPDATE users SET display_name = ? WHERE id = ?").run(name, userId);
  return getUserById(userId) as LocalUser;
}

export function rotatePairingToken(userId: string): LocalUser {
  const token = `plx_${crypto.randomBytes(16).toString("hex")}`;
  getDb().prepare("UPDATE users SET pairing_token = ? WHERE id = ?").run(token, userId);
  return getUserById(userId) as LocalUser;
}

export function touchExtensionEvent(userId: string, occurredAt: string): void {
  getDb().prepare("UPDATE users SET last_extension_event = ? WHERE id = ?").run(occurredAt, userId);
}

export function touchHealthImport(userId: string, when = toIso()): void {
  getDb().prepare("UPDATE users SET last_health_import = ? WHERE id = ?").run(when, userId);
}

export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "You";
  if (parts.length === 1) return parts[0].slice(0, 3);
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}
