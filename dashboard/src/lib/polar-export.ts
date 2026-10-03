import JSZip from "jszip";
import { getDb, setMeta } from "./db";
import { toIso } from "./dates";
import { parseDuration } from "./polar";
import {
  extractHeartRateSeries,
  sampleIntervalSeconds,
  timesFromAverage,
  timesFromSamples,
  type ZoneTimes
} from "./hr-zones";

const MIN_WORKOUT_SECONDS = 90;

const POLAR_SPORTS: Record<string, string> = {
  "1": "Running",
  "2": "Cycling",
  "3": "Walking",
  "8": "Skating",
  "9": "Cross-country skiing",
  "10": "Alpine skiing",
  "15": "Pool swimming",
  "16": "Indoor cycling",
  "17": "Group class",
  "18": "Other indoor",
  "19": "Other outdoor",
  "20": "Strength training",
  "21": "Yoga",
  "22": "Spinning",
  "23": "Pool swimming",
  "24": "Treadmill",
  "25": "Trail running"
};

const LOAD_LABELS: Record<string, string> = {
  LOAD_INTERPRETATION_VERY_HIGH: "Very high",
  LOAD_INTERPRETATION_HIGH: "High",
  LOAD_INTERPRETATION_MEDIUM: "Medium",
  LOAD_INTERPRETATION_LOW: "Light",
  LOAD_INTERPRETATION_VERY_LOW: "Easy"
};

type Json = Record<string, unknown>;

type ParsedExercise = {
  id: string;
  startTime: string;
  durationSeconds: number;
  sport: string;
  calories: number | null;
  cardioLoad: number | null;
  hrAvg: number | null;
  hrMax: number | null;
  hrCap: number | null;
  cardioLoadLabel: string | null;
  distanceMeters: number | null;
  name: string | null;
  zoneLowSeconds: number;
  zoneMidSeconds: number;
  zoneHighSeconds: number;
};

type ParsedSleep = {
  date: string;
  durationSeconds: number;
  sleepStart: string | null;
  sleepEnd: string | null;
  score: number | null;
  remSeconds: number | null;
  deepSeconds: number | null;
  lightSeconds: number | null;
  efficiencyPercent: number | null;
};

type ParsedActivity = {
  date: string;
  stepCount: number;
  stepsDistance: number | null;
  calories: number | null;
};

type ParsedRecharge = {
  date: string;
  ansCharge: number | null;
  status: string | null;
};

function fileName(pathName: string): string {
  return pathName.replace(/\\/g, "/").split("/").pop() || pathName;
}

function asRecord(value: unknown): Json | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null;
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function text(record: Json, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (value != null && String(value).trim()) return String(value);
  }
  return null;
}

function num(record: Json, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      if (/^PT/i.test(value.trim())) {
        const parsed = parseDuration(value);
        if (parsed != null) return parsed;
      }
      const numeric = Number(value);
      if (Number.isFinite(numeric)) return numeric;
    }
  }
  return null;
}

function nested(record: Json, key: string): Json | null {
  return asRecord(record[key]);
}

function polarLocalStamp(local: string): string {
  return local.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)?.[0] || local;
}

function sportName(record: Json, exercise: Json | null): string {
  const sport = nested(record, "sport") || (exercise ? nested(exercise, "sport") : null);
  const id = sport ? text(sport, ["id", "name"]) : null;
  if (id && POLAR_SPORTS[id]) return POLAR_SPORTS[id];
  if (id && /[a-z]/i.test(id)) {
    return id
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
  return id ? `Sport ${id}` : "Session";
}

function zoneTimesForExercise(
  record: Json,
  exercise: Json,
  durationSeconds: number,
  hrAvg: number | null
): { cap: number | null; times: ZoneTimes } {
  const physical = nested(record, "physicalInformation") || nested(exercise, "physicalInformation");
  const cap =
    (physical ? num(physical, ["maximumHeartRate", "maximum-heart-rate"]) : null) ??
    num(record, ["hrMax"]) ??
    num(exercise, ["hrMax"]);
  const series = extractHeartRateSeries(exercise).length
    ? extractHeartRateSeries(exercise)
    : extractHeartRateSeries(record);
  if (cap && series.length >= 8) {
    return {
      cap,
      times: timesFromSamples(series, sampleIntervalSeconds(durationSeconds, series.length), cap)
    };
  }
  if (cap && hrAvg) {
    return { cap, times: timesFromAverage(durationSeconds, hrAvg, cap) };
  }
  return { cap, times: { lowSeconds: 0, midSeconds: 0, highSeconds: 0 } };
}

function loadLabel(raw: string | null, load: number | null): string | null {
  if (load != null) {
    if (load >= 120) return "Very high";
    if (load >= 80) return "High";
    if (load >= 40) return "Medium";
    if (load >= 15) return "Light";
    return "Easy";
  }
  if (raw && LOAD_LABELS[raw]) return LOAD_LABELS[raw];
  return null;
}

function rechargeStatus(indicator: number | null): string | null {
  if (indicator == null) return null;
  if (indicator <= 2) return "poor";
  if (indicator <= 4) return "ok";
  return "good";
}

async function readJsonFiles(buffer: Buffer): Promise<Array<{ name: string; data: unknown }>> {
  const zip = await JSZip.loadAsync(buffer);
  const files: Array<{ name: string; data: unknown }> = [];

  for (const [pathName, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const name = fileName(pathName);
    if (!name.endsWith(".json")) continue;
    const raw = await entry.async("string");
    if (!raw.trim()) continue;
    try {
      files.push({ name, data: JSON.parse(raw) });
    } catch {
      // Skip unreadable JSON rather than failing the whole archive.
    }
  }

  if (!files.length) {
    throw new Error("This ZIP has no JSON files from a health export.");
  }
  return files;
}

function parseArchive(files: Array<{ name: string; data: unknown }>): {
  exercises: ParsedExercise[];
  sleeps: ParsedSleep[];
  activities: ParsedActivity[];
  recharges: ParsedRecharge[];
} {
  const scores = new Map<string, number>();
  const sleepMap = new Map<string, ParsedSleep>();
  const exercises: ParsedExercise[] = [];
  const activities: ParsedActivity[] = [];
  const recharges: ParsedRecharge[] = [];

  for (const file of files) {
    if (!file.name.startsWith("sleep_score_")) continue;
    for (const item of asList(file.data)) {
      const record = asRecord(item);
      if (!record) continue;
      const date = text(record, ["night", "date"]);
      const result = nested(record, "sleepScoreResult");
      const score = result ? num(result, ["sleepScore"]) : num(record, ["sleepScore"]);
      if (date && score != null) scores.set(date, score);
    }
  }

  for (const file of files) {
    if (file.name.startsWith("training-session_")) {
      const record = asRecord(file.data);
      if (!record) continue;
      const exercise = asRecord(asList(record.exercises)[0]) || record;
      const start = text(record, ["startTime"]) || text(exercise, ["startTime"]);
      const durationMs = num(record, ["durationMillis"]) ?? num(exercise, ["durationMillis"]) ?? 0;
      const durationSeconds = Math.round(durationMs > 5000 ? durationMs / 1000 : durationMs);
      if (!start || durationSeconds < MIN_WORKOUT_SECONDS) continue;
      const id =
        text(nested(record, "identifier") || {}, ["id"]) ||
        text(nested(exercise, "identifier") || {}, ["id"]) ||
        start;
      const report = nested(exercise, "trainingLoadReport") || nested(record, "trainingLoadReport");
      const cardioLoad = report ? num(report, ["cardioLoad"]) : num(record, ["cardioLoad"]);
      const rawLabel = report ? text(report, ["cardioLoadInterpretation"]) : null;
      const hrAvg = num(record, ["hrAvg"]) ?? num(exercise, ["hrAvg"]);
      const hrMax = num(record, ["hrMax"]) ?? num(exercise, ["hrMax"]);
      const zones = zoneTimesForExercise(record, exercise, durationSeconds, hrAvg);
      exercises.push({
        id,
        startTime: polarLocalStamp(start),
        durationSeconds,
        sport: sportName(record, exercise),
        calories: num(record, ["calories"]) ?? num(exercise, ["calories"]),
        cardioLoad,
        hrAvg,
        hrMax,
        hrCap: zones.cap,
        cardioLoadLabel: loadLabel(rawLabel, cardioLoad),
        distanceMeters: num(record, ["distanceMeters"]) ?? num(exercise, ["distanceMeters"]),
        name: text(record, ["name"]),
        zoneLowSeconds: zones.times.lowSeconds,
        zoneMidSeconds: zones.times.midSeconds,
        zoneHighSeconds: zones.times.highSeconds
      });
      continue;
    }

    if (file.name.startsWith("activity-")) {
      const record = asRecord(file.data);
      if (!record) continue;
      const date = text(record, ["date"]);
      const summary = nested(record, "summary") || record;
      const steps = num(summary, ["stepCount"]);
      if (!date || steps == null) continue;
      activities.push({
        date,
        stepCount: Math.round(steps),
        stepsDistance: num(summary, ["stepsDistance"]),
        calories: num(summary, ["calories"])
      });
      continue;
    }

    if (file.name.startsWith("sleep_result_")) {
      for (const item of asList(file.data)) {
        const record = asRecord(item);
        if (!record) continue;
        const date = text(record, ["night", "date"]);
        const evaluation = nested(record, "evaluation") || record;
        const phases = nested(evaluation, "phaseDurations");
        const analysis = nested(evaluation, "analysis");
        const result = nested(record, "sleepResult");
        const hypnogram = result ? nested(result, "hypnogram") : nested(record, "hypnogram");
        const duration =
          num(evaluation, ["asleepDuration", "sleepSpan"]) ??
          num(record, ["asleepDuration", "sleepSpan"]);
        if (!date || duration == null) continue;
        sleepMap.set(date, {
          date,
          durationSeconds: Math.round(duration),
          sleepStart: hypnogram ? text(hypnogram, ["sleepStart"]) : text(record, ["sleepStart"]),
          sleepEnd: hypnogram ? text(hypnogram, ["sleepEnd"]) : text(record, ["sleepEnd"]),
          score: scores.get(date) ?? null,
          remSeconds: phases ? num(phases, ["rem"]) : null,
          deepSeconds: phases ? num(phases, ["deep"]) : null,
          lightSeconds: phases ? num(phases, ["light"]) : null,
          efficiencyPercent: analysis ? num(analysis, ["efficiencyPercent"]) : null
        });
      }
      continue;
    }

    if (file.name.startsWith("nightly_recovery_") && !file.name.startsWith("nightly_recovery_blob")) {
      for (const item of asList(file.data)) {
        const record = asRecord(item);
        if (!record) continue;
        const date = text(record, ["night", "date"]);
        if (!date) continue;
        const indicator = num(record, ["recoveryIndicator"]);
        recharges.push({
          date,
          ansCharge:
            num(record, ["recoveryIndicatorSubLevel"]) ??
            (indicator != null ? indicator * 20 : num(record, ["ansStatus"])),
          status: rechargeStatus(indicator)
        });
      }
    }
  }

  for (const [date, score] of scores.entries()) {
    const existing = sleepMap.get(date);
    if (existing) {
      existing.score = existing.score ?? score;
    } else {
      sleepMap.set(date, {
        date,
        durationSeconds: 0,
        sleepStart: null,
        sleepEnd: null,
        score,
        remSeconds: null,
        deepSeconds: null,
        lightSeconds: null,
        efficiencyPercent: null
      });
    }
  }

  return {
    exercises,
    sleeps: [...sleepMap.values()],
    activities,
    recharges
  };
}

export async function importPolarZip(buffer: Buffer): Promise<{
  exercises: number;
  sleep: number;
  activity: number;
  recharge: number;
}> {
  const parsed = parseArchive(await readJsonFiles(buffer));
  if (!parsed.exercises.length && !parsed.sleeps.length && !parsed.activities.length) {
    throw new Error("No workouts, steps, or sleep found in this export.");
  }

  const db = getDb();
  const insertExercise = db.prepare(
    `INSERT OR REPLACE INTO exercises
      (polar_id, start_time, duration_seconds, sport, calories, cardio_load, source,
       hr_avg, hr_max, cardio_load_label, distance_meters, name,
       hr_cap, zone_low_seconds, zone_mid_seconds, zone_high_seconds)
     VALUES (?, ?, ?, ?, ?, ?, 'export', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertSleep = db.prepare(
    `INSERT OR REPLACE INTO sleep_nights
      (date, duration_seconds, sleep_start, sleep_end, source,
       score, rem_seconds, deep_seconds, light_seconds, efficiency_percent)
     VALUES (?, ?, ?, ?, 'export', ?, ?, ?, ?, ?)`
  );
  const insertActivity = db.prepare(
    `INSERT OR REPLACE INTO daily_activity
      (date, step_count, steps_distance, calories, source)
     VALUES (?, ?, ?, ?, 'export')`
  );
  const insertRecharge = db.prepare(
    `INSERT OR REPLACE INTO recharge_nights
      (date, ans_charge, status, source)
     VALUES (?, ?, ?, 'export')`
  );

  db.transaction(() => {
    db.prepare("DELETE FROM exercises").run();
    db.prepare("DELETE FROM sleep_nights").run();
    db.prepare("DELETE FROM recharge_nights").run();
    db.prepare("DELETE FROM daily_activity").run();

    for (const item of parsed.exercises) {
      insertExercise.run(
        item.id,
        item.startTime,
        item.durationSeconds,
        item.sport,
        item.calories,
        item.cardioLoad,
        item.hrAvg,
        item.hrMax,
        item.cardioLoadLabel,
        item.distanceMeters,
        item.name,
        item.hrCap,
        item.zoneLowSeconds,
        item.zoneMidSeconds,
        item.zoneHighSeconds
      );
    }
    for (const night of parsed.sleeps) {
      insertSleep.run(
        night.date,
        night.durationSeconds,
        night.sleepStart,
        night.sleepEnd,
        night.score,
        night.remSeconds,
        night.deepSeconds,
        night.lightSeconds,
        night.efficiencyPercent
      );
    }
    for (const day of parsed.activities) {
      insertActivity.run(day.date, day.stepCount, day.stepsDistance, day.calories);
    }
    for (const night of parsed.recharges) {
      insertRecharge.run(night.date, night.ansCharge, night.status);
    }
  })();

  setMeta("last_polar_sync", toIso());
  setMeta("data_source", "export");

  return {
    exercises: parsed.exercises.length,
    sleep: parsed.sleeps.length,
    activity: parsed.activities.length,
    recharge: parsed.recharges.length
  };
}
