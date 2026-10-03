import { getDb, setMeta } from "./db";
import { daysAgo, localDateKey, toIso } from "./dates";
import { insertPostEvent } from "./ingest";

function isoHoursAgo(hours: number): string {
  return toIso(new Date(Date.now() - hours * 36e5));
}

function seedDigital(): void {
  const now = new Date();

  for (let i = 0; i < 147; i += 1) {
    const hours = 4 + (i % 68);
    const occurredAt = isoHoursAgo(hours);
    const postId = `demo-neg-3d-${i}`;
    insertPostEvent({
      eventType: "classified",
      platform: "facebook",
      postId,
      isNegative: true,
      occurredAt
    });
    insertPostEvent({
      eventType: "hidden",
      platform: "facebook",
      postId,
      isNegative: true,
      occurredAt
    });
    if (i < 8) {
      insertPostEvent({
        eventType: "revealed",
        platform: "facebook",
        postId,
        isNegative: true,
        occurredAt: isoHoursAgo(hours - 0.2)
      });
    }
  }

  for (let i = 0; i < 40; i += 1) {
    insertPostEvent({
      eventType: "classified",
      platform: "facebook",
      postId: `demo-pos-3d-${i}`,
      isNegative: false,
      occurredAt: isoHoursAgo(6 + (i % 60))
    });
  }

  for (let day = 4; day <= 14; day += 1) {
    const baseHours = day * 24 + 8;
    for (let i = 0; i < 8; i += 1) {
      const postId = `demo-base-${day}-${i}`;
      const occurredAt = isoHoursAgo(baseHours + i);
      const negative = i < 3;
      insertPostEvent({
        eventType: "classified",
        platform: "facebook",
        postId,
        isNegative: negative,
        occurredAt
      });
      if (negative) {
        insertPostEvent({
          eventType: "hidden",
          platform: "facebook",
          postId,
          isNegative: true,
          occurredAt
        });
      }
    }
  }

  setMeta("last_extension_event", now.toISOString());
}

function seedHealth(): void {
  const db = getDb();
  db.prepare("DELETE FROM sleep_nights").run();
  db.prepare("DELETE FROM exercises").run();
  db.prepare("DELETE FROM recharge_nights").run();
  db.prepare("DELETE FROM daily_activity").run();
  const insertSleep = db.prepare(
    `INSERT OR REPLACE INTO sleep_nights
      (date, duration_seconds, sleep_start, sleep_end, source)
     VALUES (?, ?, ?, ?, 'fixture')`
  );
  const insertExercise = db.prepare(
    `INSERT OR REPLACE INTO exercises
      (polar_id, start_time, duration_seconds, sport, calories, cardio_load, source)
     VALUES (?, ?, ?, ?, ?, ?, 'fixture')`
  );
  const insertRecharge = db.prepare(
    `INSERT OR REPLACE INTO recharge_nights
      (date, ans_charge, status, source)
     VALUES (?, ?, ?, 'fixture')`
  );

  for (let day = 0; day < 14; day += 1) {
    const date = daysAgo(day);
    const key = localDateKey(date);
    const hours = day <= 2 ? 6.2 + day * 0.15 : 7.4 + ((day % 3) - 1) * 0.25;
    const start = new Date(date);
    start.setHours(23, 10, 0, 0);
    start.setDate(start.getDate() - 1);
    const end = new Date(start.getTime() + hours * 36e5);
    insertSleep.run(key, Math.round(hours * 3600), start.toISOString(), end.toISOString());

    const ans = day === 0 ? 28 : day === 1 ? 36 : 62 + (day % 5) * 4;
    const status = ans < 40 ? "poor" : ans < 60 ? "ok" : "good";
    insertRecharge.run(key, ans, status);
  }

  const workouts = [
    { daysAgo: 4, sport: "Running", minutes: 38, calories: 410, load: 90 },
    { daysAgo: 7, sport: "Cycling", minutes: 55, calories: 520, load: 110 },
    { daysAgo: 10, sport: "Strength", minutes: 42, calories: 280, load: 70 },
    { daysAgo: 13, sport: "Walking", minutes: 48, calories: 220, load: 40 }
  ];

  for (const [index, workout] of workouts.entries()) {
    const start = daysAgo(workout.daysAgo);
    start.setHours(18, 15, 0, 0);
    insertExercise.run(
      `fixture-ex-${index}`,
      start.toISOString(),
      workout.minutes * 60,
      workout.sport,
      workout.calories,
      workout.load
    );
  }
}

export function seedDemoData(): void {
  seedDigital();
  seedHealth();
  setMeta("data_source", "fixture");
}
