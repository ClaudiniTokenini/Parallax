import { getSoloUser, getUserById } from "./auth";
import { getDb, getMeta } from "./db";
import { hoursBetween, isoDaysAgo, localDateKey, secondsToHours } from "./dates";
import { computeMentalSummary, PLATFORM_LABEL } from "./mental-summary";
import { computePhysicalSummary } from "./physical-summary";
import type {
  DailyActivity,
  DataSource,
  DigitalCounts,
  Exercise,
  MentalPayload,
  MentalPlatformShare,
  PhysicalPayload,
  Platform,
  RechargeNight,
  SettingsPayload,
  SleepNight
} from "./types";

function asRate(numerator: number, denominator: number): number | null {
  if (!denominator) return null;
  return numerator / denominator;
}

function uid(userId?: string): string {
  return userId || getSoloUser().id;
}

function countsFromRow(row: {
  classified: number | null;
  negative: number | null;
  hidden: number | null;
  revealed: number | null;
}): DigitalCounts {
  const classified = Number(row.classified || 0);
  const negative = Number(row.negative || 0);
  const hidden = Number(row.hidden || 0);
  const revealed = Number(row.revealed || 0);
  return {
    classified,
    negative,
    hidden,
    revealed,
    negativityRate: asRate(negative, classified),
    revealRate: asRate(revealed, hidden)
  };
}

function digitalSince(userId: string, isoFrom: string, platform?: Platform): DigitalCounts {
  const dateFrom = localDateKey(new Date(isoFrom));
  const row = getDb()
    .prepare(
      `SELECT
         COALESCE(SUM(classified), 0) AS classified,
         COALESCE(SUM(negative), 0) AS negative,
         COALESCE(SUM(hidden), 0) AS hidden,
         COALESCE(SUM(revealed), 0) AS revealed
       FROM mental_daily
       WHERE user_id = ?
         AND date >= ?
         ${platform ? "AND platform = ?" : ""}`
    )
    .get(...(platform ? [userId, dateFrom, platform] : [userId, dateFrom])) as {
    classified: number | null;
    negative: number | null;
    hidden: number | null;
    revealed: number | null;
  };

  return countsFromRow(row);
}

function mapSleep(row: {
  date: string;
  duration_seconds: number;
  sleep_start: string | null;
  sleep_end: string | null;
  source: string;
  score: number | null;
  rem_seconds: number | null;
  deep_seconds: number | null;
  light_seconds: number | null;
  efficiency_percent: number | null;
}): SleepNight {
  return {
    date: row.date,
    durationSeconds: row.duration_seconds,
    sleepStart: row.sleep_start,
    sleepEnd: row.sleep_end,
    source: row.source,
    score: row.score,
    remSeconds: row.rem_seconds,
    deepSeconds: row.deep_seconds,
    lightSeconds: row.light_seconds,
    efficiencyPercent: row.efficiency_percent
  };
}

function mapExercise(row: {
  polar_id: string;
  start_time: string;
  duration_seconds: number;
  sport: string | null;
  calories: number | null;
  cardio_load: number | null;
  cardio_load_label: string | null;
  hr_avg: number | null;
  hr_max: number | null;
  hr_cap: number | null;
  distance_meters: number | null;
  name: string | null;
  source: string;
  zone_low_seconds: number | null;
  zone_mid_seconds: number | null;
  zone_high_seconds: number | null;
}): Exercise {
  return {
    polarId: row.polar_id,
    startTime: row.start_time,
    durationSeconds: row.duration_seconds,
    sport: row.sport,
    calories: row.calories,
    cardioLoad: row.cardio_load,
    cardioLoadLabel: row.cardio_load_label,
    hrAvg: row.hr_avg,
    hrMax: row.hr_max,
    hrCap: row.hr_cap,
    distanceMeters: row.distance_meters,
    name: row.name,
    source: row.source,
    zoneLowSeconds: row.zone_low_seconds || 0,
    zoneMidSeconds: row.zone_mid_seconds || 0,
    zoneHighSeconds: row.zone_high_seconds || 0
  };
}

function mapActivity(row: {
  date: string;
  step_count: number;
  steps_distance: number | null;
  calories: number | null;
  source: string;
}): DailyActivity {
  return {
    date: row.date,
    stepCount: row.step_count,
    stepsDistance: row.steps_distance,
    calories: row.calories,
    source: row.source
  };
}

function mapRecharge(row: {
  date: string;
  ans_charge: number | null;
  status: string | null;
  source: string;
}): RechargeNight {
  return {
    date: row.date,
    ansCharge: row.ans_charge,
    status: row.status,
    source: row.source
  };
}

export function getDigitalCounts(days: number, userId?: string, platform?: Platform): DigitalCounts {
  return digitalSince(uid(userId), isoDaysAgo(days), platform);
}

function platformShares(userId: string): MentalPlatformShare[] {
  const platforms: Platform[] = ["facebook", "twitter"];
  return platforms
    .map((platform) => ({
      platform,
      label: PLATFORM_LABEL[platform],
      counts: getDigitalCounts(3, userId, platform)
    }))
    .filter((item) => item.counts.classified + item.counts.hidden + item.counts.revealed > 0);
}

export function getSleepNights(limit = 365, userId?: string): SleepNight[] {
  const rows = getDb()
    .prepare(
      `SELECT date, duration_seconds, sleep_start, sleep_end, source,
              score, rem_seconds, deep_seconds, light_seconds, efficiency_percent
       FROM sleep_nights
       WHERE user_id = ?
       ORDER BY date DESC
       LIMIT ?`
    )
    .all(uid(userId), limit) as Parameters<typeof mapSleep>[0][];
  return rows.map(mapSleep);
}

export function getExercises(limit = 365, userId?: string): Exercise[] {
  const rows = getDb()
    .prepare(
      `SELECT polar_id, start_time, duration_seconds, sport, calories, cardio_load, source,
              hr_avg, hr_max, cardio_load_label, distance_meters, name,
              hr_cap, zone_low_seconds, zone_mid_seconds, zone_high_seconds
       FROM exercises
       WHERE user_id = ?
       ORDER BY start_time DESC
       LIMIT ?`
    )
    .all(uid(userId), limit) as Parameters<typeof mapExercise>[0][];
  return rows.map(mapExercise);
}

export function getRechargeNights(limit = 365, userId?: string): RechargeNight[] {
  const rows = getDb()
    .prepare(
      `SELECT date, ans_charge, status, source
       FROM recharge_nights
       WHERE user_id = ?
       ORDER BY date DESC
       LIMIT ?`
    )
    .all(uid(userId), limit) as Parameters<typeof mapRecharge>[0][];
  return rows.map(mapRecharge);
}

export function getDailyActivity(limit = 365, userId?: string): DailyActivity[] {
  const rows = getDb()
    .prepare(
      `SELECT date, step_count, steps_distance, calories, source
       FROM daily_activity
       WHERE user_id = ?
       ORDER BY date DESC
       LIMIT ?`
    )
    .all(uid(userId), limit) as Parameters<typeof mapActivity>[0][];
  return rows.map(mapActivity);
}

export function meanSleepHours(nights: SleepNight[], take: number): number | null {
  const slice = nights.filter((night) => night.durationSeconds > 0).slice(0, take);
  if (!slice.length) return null;
  const total = slice.reduce((sum, night) => sum + secondsToHours(night.durationSeconds), 0);
  return total / slice.length;
}

export function getPhysicalPayload(userId?: string): PhysicalPayload {
  const id = uid(userId);
  const user = getUserById(id) ?? getSoloUser();
  const sleepNights = getSleepNights(365, id);
  const exercises = getExercises(365, id);
  const rechargeNights = getRechargeNights(365, id);
  const activity = getDailyActivity(365, id);
  const lastWorkout = exercises[0] ?? null;
  const stepDays = activity.filter((item) => item.stepCount > 0);
  const scored = sleepNights.find((night) => night.score != null);

  return {
    dataSource: (getMeta("data_source") as DataSource | null) ?? null,
    lastPolarSync: user.lastHealthImport,
    hoursSinceWorkout: lastWorkout ? hoursBetween(lastWorkout.startTime) : null,
    lastWorkout,
    sleepNights,
    exercises,
    rechargeNights,
    summary: computePhysicalSummary(sleepNights, exercises, rechargeNights, activity),
    recentSleepHours: meanSleepHours(sleepNights, 3),
    baselineSleepHours: meanSleepHours(sleepNights, 14),
    averageSteps: stepDays.length
      ? Math.round(stepDays.reduce((sum, item) => sum + item.stepCount, 0) / stepDays.length)
      : null,
    lastSleepScore: scored?.score ?? null,
    lastActivityDate: activity[0]?.date ?? null
  };
}

export function getMentalPayload(userId?: string): MentalPayload {
  const id = uid(userId);
  const user = getUserById(id) ?? getSoloUser();
  const last3Days = getDigitalCounts(3, id);
  const last14Days = getDigitalCounts(14, id);
  const platforms = platformShares(id);

  return {
    last3Days,
    last14Days,
    lastExtensionEvent: user.lastExtensionEvent,
    displayName: user.displayName,
    summary: computeMentalSummary(last3Days, last14Days, platforms)
  };
}

export function getSettingsPayload(userId?: string): SettingsPayload {
  const id = uid(userId);
  const user = getUserById(id) ?? getSoloUser();
  const database = getDb();
  const polar = database
    .prepare("SELECT user_id FROM polar_accounts LIMIT 1")
    .get() as { user_id: string } | undefined;

  return {
    dataSource: (getMeta("data_source") as DataSource | null) ?? null,
    lastExtensionEvent: user.lastExtensionEvent,
    lastPolarSync: user.lastHealthImport,
    polarConnected: Boolean(polar),
    polarUserId: polar?.user_id ?? null,
    polarConfigured: Boolean(process.env.POLAR_CLIENT_ID && process.env.POLAR_CLIENT_SECRET),
    eventCount: (
      database
        .prepare("SELECT COUNT(*) AS count FROM post_events WHERE user_id = ?")
        .get(id) as { count: number }
    ).count,
    sleepCount: (
      database
        .prepare("SELECT COUNT(*) AS count FROM sleep_nights WHERE user_id = ?")
        .get(id) as { count: number }
    ).count,
    exerciseCount: (
      database
        .prepare("SELECT COUNT(*) AS count FROM exercises WHERE user_id = ?")
        .get(id) as { count: number }
    ).count,
    activityCount: (
      database
        .prepare("SELECT COUNT(*) AS count FROM daily_activity WHERE user_id = ?")
        .get(id) as { count: number }
    ).count,
    displayName: user.displayName,
    username: user.username,
    hasPassword: user.hasPassword,
    pairingToken: user.pairingToken,
    userId: user.id
  };
}
