import crypto from "node:crypto";
import { getDb } from "./db";
import { toIso } from "./dates";

export const SESSION_COOKIE = "parallax_sid";

export type LocalUser = {
  id: string;
  displayName: string;
  pairingToken: string;
  lastExtensionEvent: string | null;
  lastHealthImport: string | null;
};

type UserRow = {
  id: string;
  display_name: string;
  pairing_token: string;
  last_extension_event: string | null;
  last_health_import: string | null;
};

function mapUser(row: UserRow): LocalUser {
  return {
    id: row.id,
    displayName: row.display_name,
    pairingToken: row.pairing_token,
    lastExtensionEvent: row.last_extension_event,
    lastHealthImport: row.last_health_import
  };
}

function createUser(displayName = "You"): LocalUser {
  const row: UserRow = {
    id: crypto.randomUUID(),
    display_name: displayName.trim() || "You",
    pairing_token: `plx_${crypto.randomBytes(16).toString("hex")}`,
    last_extension_event: null,
    last_health_import: null
  };
  getDb()
    .prepare(
      `INSERT INTO users (id, display_name, pairing_token, created_at)
       VALUES (?, ?, ?, ?)`
    )
    .run(row.id, row.display_name, row.pairing_token, toIso());
  return mapUser(row);
}

export function getUserById(userId: string): LocalUser | null {
  const row = getDb()
    .prepare(
      `SELECT id, display_name, pairing_token, last_extension_event, last_health_import
       FROM users
       WHERE id = ?`
    )
    .get(userId) as UserRow | undefined;
  return row ? mapUser(row) : null;
}

export function getSoloUser(): LocalUser {
  const row = getDb()
    .prepare(
      `SELECT id, display_name, pairing_token, last_extension_event, last_health_import
       FROM users
       ORDER BY created_at
       LIMIT 1`
    )
    .get() as UserRow | undefined;
  return row ? mapUser(row) : createUser();
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

export function getOrCreateLocalUser(sessionId: string | null): LocalUser {
  if (sessionId) {
    const row = getDb()
      .prepare(
        `SELECT u.id, u.display_name, u.pairing_token, u.last_extension_event, u.last_health_import
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.id = ?`
      )
      .get(sessionId) as UserRow | undefined;
    if (row) {
      getDb().prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?").run(toIso(), sessionId);
      return mapUser(row);
    }
  }

  const user = getSoloUser();
  if (sessionId) bindSession(sessionId, user.id);
  return user;
}

export async function getRequestUser(): Promise<LocalUser> {
  try {
    const { cookies } = await import("next/headers");
    const jar = await cookies();
    return getOrCreateLocalUser(jar.get(SESSION_COOKIE)?.value ?? null);
  } catch {
    return getSoloUser();
  }
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
): { user: LocalUser | null; invalidToken: boolean } {
  const token = readToken(request, extraToken);
  if (token) {
    const row = getDb()
      .prepare(
        `SELECT id, display_name, pairing_token, last_extension_event, last_health_import
         FROM users
         WHERE pairing_token = ?`
      )
      .get(token) as UserRow | undefined;
    return row ? { user: mapUser(row), invalidToken: false } : { user: null, invalidToken: true };
  }
  return { user: getSoloUser(), invalidToken: false };
}

export function renameUser(userId: string, displayName: string): LocalUser {
  const name = displayName.trim().slice(0, 40) || "You";
  getDb().prepare("UPDATE users SET display_name = ? WHERE id = ?").run(name, userId);
  const row = getDb()
    .prepare(
      `SELECT id, display_name, pairing_token, last_extension_event, last_health_import
       FROM users WHERE id = ?`
    )
    .get(userId) as UserRow;
  return mapUser(row);
}

export function rotatePairingToken(userId: string): LocalUser {
  const token = `plx_${crypto.randomBytes(16).toString("hex")}`;
  getDb().prepare("UPDATE users SET pairing_token = ? WHERE id = ?").run(token, userId);
  const row = getDb()
    .prepare(
      `SELECT id, display_name, pairing_token, last_extension_event, last_health_import
       FROM users WHERE id = ?`
    )
    .get(userId) as UserRow;
  return mapUser(row);
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
