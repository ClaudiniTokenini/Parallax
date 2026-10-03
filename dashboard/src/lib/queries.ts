import { getDb, getMeta } from "./db";
import { hoursBetween, isoDaysAgo, secondsToHours } from "./dates";
import type {
  DailyActivity,
  DataSource,
  DigitalCounts,
  Exercise,
  MentalPayload,
  PhysicalPayload,
  RechargeNight,
  SettingsPayload,
  SleepNight
} from "./types";
import { computePhysicalSummary } from "./physical-summary";

function asRate(numerator: number, denominator: number): number | null {
  if (!denominator) return null;
  return numerator / denominator;
}

function digitalSince(isoFrom: string): DigitalCounts {
  const row = getDb()
    .prepare(
      `SELECT
         SUM(CASE WHEN event_type = 'classified' THEN 1 ELSE 0 END) AS classified,
         SUM(CASE WHEN event_type = 'classified' AND is_negative = 1 THEN 1 ELSE 0 END) AS negative,
         SUM(CASE WHEN event_type = 'hidden' THEN 1 ELSE 0 END) AS hidden,
         SUM(CASE WHEN event_type = 'revealed' THEN 1 ELSE 0 END) AS revealed
       FROM post_events
       WHERE occurred_at >= ?`
    )
    .get(isoFrom) as {
    classified: number | null;
    negative: number | null;
    hidden: number | null;
    revealed: number | null;
  };

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

export function getDigitalCounts(days: number): DigitalCounts {
  return digitalSince(isoDaysAgo(days));
}

export function getSleepNights(limit = 365): SleepNight[] {
  const rows = getDb()
    .prepare(
      `SELECT date, duration_seconds, sleep_start, sleep_end, source,
              score, rem_seconds, deep_seconds, light_seconds, efficiency_percent
       FROM sleep_nights
       ORDER BY date DESC
       LIMIT ?`
    )
    .all(limit) as Parameters<typeof mapSleep>[0][];
  return rows.map(mapSleep);
}

export function getExercises(limit = 365): Exercise[] {
  const rows = getDb()
    .prepare(
      `SELECT polar_id, start_time, duration_seconds, sport, calories, cardio_load, source,
              hr_avg, hr_max, cardio_load_label, distance_meters, name,
              hr_cap, zone_low_seconds, zone_mid_seconds, zone_high_seconds
       FROM exercises
       ORDER BY start_time DESC
       LIMIT ?`
    )
    .all(limit) as Parameters<typeof mapExercise>[0][];
  return rows.map(mapExercise);
}

export function getRechargeNights(limit = 365): RechargeNight[] {
  const rows = getDb()
    .prepare(
      `SELECT date, ans_charge, status, source
       FROM recharge_nights
       ORDER BY date DESC
       LIMIT ?`
    )
    .all(limit) as Parameters<typeof mapRecharge>[0][];
  return rows.map(mapRecharge);
}

export function getDailyActivity(limit = 365): DailyActivity[] {
  const rows = getDb()
    .prepare(
      `SELECT date, step_count, steps_distance, calories, source
       FROM daily_activity
       ORDER BY date DESC
       LIMIT ?`
    )
    .all(limit) as Parameters<typeof mapActivity>[0][];
  return rows.map(mapActivity);
}

export function meanSleepHours(nights: SleepNight[], take: number): number | null {
  const slice = nights.filter((night) => night.durationSeconds > 0).slice(0, take);
  if (!slice.length) return null;
  const total = slice.reduce((sum, night) => sum + secondsToHours(night.durationSeconds), 0);
  return total / slice.length;
}

export function getPhysicalPayload(): PhysicalPayload {
  const sleepNights = getSleepNights();
  const exercises = getExercises();
  const rechargeNights = getRechargeNights();
  const activity = getDailyActivity();
  const lastWorkout = exercises[0] ?? null;
  const stepDays = activity.filter((item) => item.stepCount > 0);
  const scored = sleepNights.find((night) => night.score != null);

  return {
    dataSource: (getMeta("data_source") as DataSource | null) ?? null,
    lastPolarSync: getMeta("last_polar_sync"),
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
    lastSleepScore: scored?.score ?? null
  };
}

export function getMentalPayload(): MentalPayload {
  return {
    last3Days: getDigitalCounts(3),
    last14Days: getDigitalCounts(14),
    lastExtensionEvent: getMeta("last_extension_event")
  };
}

export function getSettingsPayload(): SettingsPayload {
  const database = getDb();
  const polar = database
    .prepare("SELECT user_id FROM polar_accounts LIMIT 1")
    .get() as { user_id: string } | undefined;

  return {
    dataSource: (getMeta("data_source") as DataSource | null) ?? null,
    lastExtensionEvent: getMeta("last_extension_event"),
    lastPolarSync: getMeta("last_polar_sync"),
    polarConnected: Boolean(polar),
    polarUserId: polar?.user_id ?? null,
    polarConfigured: Boolean(process.env.POLAR_CLIENT_ID && process.env.POLAR_CLIENT_SECRET),
    eventCount: (
      database.prepare("SELECT COUNT(*) AS count FROM post_events").get() as { count: number }
    ).count,
    sleepCount: (
      database.prepare("SELECT COUNT(*) AS count FROM sleep_nights").get() as { count: number }
    ).count,
    exerciseCount: (
      database.prepare("SELECT COUNT(*) AS count FROM exercises").get() as { count: number }
    ).count,
    activityCount: (
      database.prepare("SELECT COUNT(*) AS count FROM daily_activity").get() as { count: number }
    ).count
  };
}
