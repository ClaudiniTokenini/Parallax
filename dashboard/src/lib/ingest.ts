import { getDb } from "./db";
import { localDateKey, toIso } from "./dates";
import { getSoloUser, touchExtensionEvent } from "./auth";
import type { EventType, Platform, PostEventInput } from "./types";

const EVENT_TYPES = new Set<EventType>(["classified", "hidden", "revealed"]);
const PLATFORMS = new Set<Platform>(["facebook", "twitter"]);

export function parseEventInput(body: unknown): PostEventInput | { error: string } {
  if (!body || typeof body !== "object") return { error: "Expected a JSON object" };

  const input = body as Record<string, unknown>;
  const eventType = String(input.eventType || "");
  const platform = String(input.platform || "facebook");
  const postId = String(input.postId || "").trim();
  const occurredAt =
    typeof input.occurredAt === "string" && input.occurredAt
      ? input.occurredAt
      : toIso();

  if (!EVENT_TYPES.has(eventType as EventType)) {
    return { error: "eventType must be classified, hidden, or revealed" };
  }
  if (!PLATFORMS.has(platform as Platform)) {
    return { error: "platform must be facebook or twitter" };
  }
  if (!postId) return { error: "postId is required" };
  if (Number.isNaN(new Date(occurredAt).getTime())) {
    return { error: "occurredAt must be an ISO timestamp" };
  }

  let isNegative: boolean | null = null;
  if (typeof input.isNegative === "boolean") isNegative = input.isNegative;
  else if (input.isNegative === 1 || input.isNegative === "true") isNegative = true;
  else if (input.isNegative === 0 || input.isNegative === "false") isNegative = false;

  return {
    eventType: eventType as EventType,
    platform: platform as Platform,
    postId,
    isNegative,
    occurredAt,
    pairingToken:
      typeof input.pairingToken === "string" && input.pairingToken.trim()
        ? input.pairingToken.trim()
        : null
  };
}

function bumpDaily(input: {
  userId: string;
  date: string;
  platform: string;
  classified: number;
  negative: number;
  hidden: number;
  revealed: number;
}): void {
  getDb()
    .prepare(
      `INSERT INTO mental_daily
        (user_id, date, platform, classified, negative, hidden, revealed)
       VALUES (@userId, @date, @platform, @classified, @negative, @hidden, @revealed)
       ON CONFLICT(user_id, date, platform) DO UPDATE SET
         classified = classified + excluded.classified,
         negative = negative + excluded.negative,
         hidden = hidden + excluded.hidden,
         revealed = revealed + excluded.revealed`
    )
    .run(input);
}

export function insertPostEvent(
  input: PostEventInput,
  userId = getSoloUser().id
): { inserted: boolean } {
  const occurredAt = input.occurredAt || toIso();
  const result = getDb()
    .prepare(
      `INSERT OR IGNORE INTO post_events
        (user_id, occurred_at, platform, post_id, event_type, is_negative)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      userId,
      occurredAt,
      input.platform,
      input.postId,
      input.eventType,
      input.isNegative == null ? null : input.isNegative ? 1 : 0
    );

  if (result.changes > 0) {
    bumpDaily({
      userId,
      date: localDateKey(new Date(occurredAt)),
      platform: input.platform,
      classified: input.eventType === "classified" ? 1 : 0,
      negative: input.eventType === "classified" && input.isNegative ? 1 : 0,
      hidden: input.eventType === "hidden" ? 1 : 0,
      revealed: input.eventType === "revealed" ? 1 : 0
    });
  }

  touchExtensionEvent(userId, occurredAt);
  return { inserted: result.changes > 0 };
}
