import { formatMinutes, formatShortDate, secondsToHours } from "./dates";
import { dominantZone, timesFromAverage, type ZoneTimes } from "./hr-zones";
import type {
  DailyActivity,
  Exercise,
  HeartZoneStats,
  PhysicalSummary,
  RechargeNight,
  SleepNight
} from "./types";

const PEP_TALKS = [
  "Great work!",
  "You showed up.",
  "That's a body that moved.",
  "Proud of this stretch.",
  "Keep going.",
  "Nice work out there.",
  "You did the work.",
  "Look at you go."
];

function roundKm(meters: number): number {
  return meters / 1000;
}

function formatKm(km: number): string {
  if (km >= 10) return km.toFixed(0);
  if (km >= 1) return km.toFixed(1);
  return km.toFixed(2);
}

function dateKey(value: string): string {
  return value.slice(0, 10);
}

function periodLabel(dates: string[]): { label: string; dayCount: number } {
  if (!dates.length) return { label: "No stretch loaded yet", dayCount: 0 };
  const sorted = [...dates].sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const dayCount =
    Math.round(
      (new Date(`${last}T12:00:00`).getTime() - new Date(`${first}T12:00:00`).getTime()) / 864e5
    ) + 1;
  if (first === last) return { label: formatShortDate(first), dayCount: 1 };
  return {
    label: `${formatShortDate(first)} – ${formatShortDate(last)}`,
    dayCount
  };
}

function sportDistance(exercises: Exercise[], matcher: (sport: string) => boolean): number {
  return exercises
    .filter((item) => matcher((item.sport || "").toLowerCase()) && (item.distanceMeters || 0) >= 50)
    .reduce((sum, item) => sum + (item.distanceMeters || 0), 0);
}

function userHrCap(exercises: Exercise[]): number {
  return Math.max(
    180,
    ...exercises.map((item) => item.hrCap || 0),
    ...exercises.map((item) => item.hrMax || 0)
  );
}

function zoneTimesFor(exercise: Exercise, cap: number): ZoneTimes | null {
  const stored = exercise.zoneLowSeconds + exercise.zoneMidSeconds + exercise.zoneHighSeconds;
  if (stored > 0) {
    return {
      lowSeconds: exercise.zoneLowSeconds,
      midSeconds: exercise.zoneMidSeconds,
      highSeconds: exercise.zoneHighSeconds
    };
  }
  if (exercise.hrAvg) return timesFromAverage(exercise.durationSeconds, exercise.hrAvg, cap);
  return null;
}

function heartStats(exercises: Exercise[]): HeartZoneStats | null {
  const cap = userHrCap(exercises);
  let lowSeconds = 0;
  let midSeconds = 0;
  let highSeconds = 0;
  let lowSessions = 0;
  let highSessions = 0;
  let mixedSessions = 0;

  for (const exercise of exercises) {
    const times = zoneTimesFor(exercise, cap);
    if (!times) continue;
    lowSeconds += times.lowSeconds;
    midSeconds += times.midSeconds;
    highSeconds += times.highSeconds;
    const zone = dominantZone(times);
    if (zone === "high") highSessions += 1;
    else if (zone === "low") lowSessions += 1;
    else mixedSessions += 1;
  }

  if (!lowSeconds && !highSeconds && !midSeconds) return null;

  const total = lowSeconds + midSeconds + highSeconds;
  const highShare = total ? highSeconds / total : 0;
  let verdict = "A mix of easy and harder work.";
  let verdictDetail = `${lowSessions} easy-zone sessions, ${highSessions} high-intensity, ${mixedSessions} in the middle.`;
  if (highShare >= 0.45 || (highSessions && highSessions >= lowSessions && highSeconds >= 20 * 60)) {
    verdict = "This stretch ran hot.";
    verdictDetail = `${highSessions} session${highSessions === 1 ? "" : "s"} spent most of the time in a high heart-rate zone.`;
  } else if (lowSeconds >= highSeconds * 2) {
    verdict = "Most of your training stayed easy on the heart.";
    verdictDetail = `${lowSessions} session${lowSessions === 1 ? "" : "s"} lived in a low heart-rate zone.`;
  }

  return {
    lowSeconds,
    highSeconds,
    midSeconds,
    lowSessions,
    highSessions,
    mixedSessions,
    verdict,
    verdictDetail
  };
}

export function computePhysicalSummary(
  sleepNights: SleepNight[],
  exercises: Exercise[],
  rechargeNights: RechargeNight[],
  activity: DailyActivity[]
): PhysicalSummary {
  const dates = [
    ...sleepNights.map((night) => night.date),
    ...rechargeNights.map((night) => night.date),
    ...activity.map((day) => day.date),
    ...exercises.map((item) => dateKey(item.startTime))
  ];
  const period = periodLabel(dates);

  const totalMeters = exercises.reduce(
    (sum, item) => sum + ((item.distanceMeters || 0) >= 50 ? item.distanceMeters || 0 : 0),
    0
  );
  const runMeters = sportDistance(exercises, (sport) => sport.includes("run"));
  const swimMeters = sportDistance(
    exercises,
    (sport) => sport.includes("swim") || sport.includes("pool")
  );
  const walkMeters = sportDistance(exercises, (sport) => sport.includes("walk"));
  const totalMinutes = Math.round(
    exercises.reduce((sum, item) => sum + item.durationSeconds, 0) / 60
  );
  const totalSteps = activity.reduce((sum, day) => sum + day.stepCount, 0);
  const stepDays = activity.filter((day) => day.stepCount > 0);
  const averageSteps = stepDays.length
    ? Math.round(stepDays.reduce((sum, day) => sum + day.stepCount, 0) / stepDays.length)
    : null;
  const bestSteps = stepDays.reduce((best, day) => Math.max(best, day.stepCount), 0);
  const sleepWithTime = sleepNights.filter((night) => night.durationSeconds > 0);
  const avgSleep = sleepWithTime.length
    ? sleepWithTime.reduce((sum, night) => sum + secondsToHours(night.durationSeconds), 0) /
      sleepWithTime.length
    : null;
  const scored = sleepWithTime.filter((night) => night.score != null);
  const avgScore = scored.length
    ? scored.reduce((sum, night) => sum + (night.score || 0), 0) / scored.length
    : null;
  const solidNights = sleepWithTime.filter((night) => night.durationSeconds >= 7 * 3600).length;
  const calories = exercises.reduce((sum, item) => sum + (item.calories || 0), 0);

  const sportsMap = new Map<string, { count: number; minutes: number; meters: number }>();
  for (const exercise of exercises) {
    const sport = exercise.sport || "Session";
    const current = sportsMap.get(sport) || { count: 0, minutes: 0, meters: 0 };
    current.count += 1;
    current.minutes += Math.round(exercise.durationSeconds / 60);
    current.meters += (exercise.distanceMeters || 0) >= 50 ? exercise.distanceMeters || 0 : 0;
    sportsMap.set(sport, current);
  }
  const sports = [...sportsMap.entries()]
    .map(([sport, value]) => ({
      sport,
      count: value.count,
      minutes: value.minutes,
      distanceKm: value.meters >= 50 ? Math.round(roundKm(value.meters) * 10) / 10 : null
    }))
    .sort((a, b) => b.minutes - a.minutes);

  const highlights = [];
  if (exercises.length) {
    highlights.push({
      label: "Sessions",
      value: String(exercises.length),
      detail:
        exercises.length === 1
          ? "You showed up once. That still counts."
          : `You completed ${exercises.length} workouts in this stretch.`
    });
  }
  if (totalMeters >= 50) {
    const km = roundKm(totalMeters);
    highlights.push({
      label: "Distance",
      value: `${formatKm(km)} km`,
      detail: runMeters
        ? `${formatKm(roundKm(runMeters))} km of that was running.`
        : "Distance from GPS and pool length."
    });
  }
  if (totalMinutes) {
    highlights.push({
      label: "Time moving",
      value: formatMinutes(totalMinutes * 60),
      detail: calories
        ? `About ${Math.round(calories).toLocaleString("en-GB")} kcal across the sessions.`
        : "Total training time."
    });
  }
  if (totalSteps) {
    highlights.push({
      label: "Steps",
      value: totalSteps.toLocaleString("en-GB"),
      detail: averageSteps
        ? `About ${averageSteps.toLocaleString("en-GB")} a day, best day ${bestSteps.toLocaleString("en-GB")}.`
        : "Daily step total for this stretch."
    });
  }
  if (avgSleep != null) {
    highlights.push({
      label: "Sleep",
      value: `${avgSleep.toFixed(1)}h`,
      detail:
        `${sleepWithTime.length} nights in the log` +
        (solidNights ? `, ${solidNights} at seven hours or more` : "") +
        (avgScore != null ? `, score ${Math.round(avgScore)}.` : ".")
    });
  }

  const km = roundKm(totalMeters);
  const runKm = roundKm(runMeters);
  let affirmation = "Upload a health ZIP and this page becomes a recap of what you already did.";
  if (runKm >= 8) {
    affirmation = `You ran ${formatKm(runKm)} kilometres in this stretch.`;
  } else if (km >= 8) {
    affirmation = `You covered ${formatKm(km)} kilometres of training.`;
  } else if (exercises.length >= 4) {
    affirmation = `You showed up for ${exercises.length} training sessions.`;
  } else if (totalSteps >= 80000) {
    affirmation = `You took ${Math.round(totalSteps / 1000)} thousand steps.`;
  } else if (solidNights >= 6) {
    affirmation = `You slept seven hours or more on ${solidNights} nights.`;
  } else if (avgSleep != null && avgSleep >= 7) {
    affirmation = `You averaged ${avgSleep.toFixed(1)} hours of sleep.`;
  } else if (swimMeters >= 400) {
    affirmation = `You swam ${Math.round(swimMeters)} metres in the pool.`;
  } else if (exercises.length >= 1) {
    affirmation =
      exercises.length === 1
        ? "You got one session done. That's a start."
        : `You got ${exercises.length} sessions done.`;
  } else if (walkMeters >= 1000) {
    affirmation = `You walked ${formatKm(roundKm(walkMeters))} km just in recorded walks.`;
  }

  const sportBits = sports
    .slice(0, 3)
    .map((item) => `${item.count} ${item.sport.toLowerCase()}`)
    .join(", ");
  const supporting = period.dayCount
    ? `${period.label} · ${period.dayCount} day${period.dayCount === 1 ? "" : "s"}` +
      (sportBits ? ` · ${sportBits}` : "")
    : "No stretch loaded yet";

  return {
    periodLabel: period.label,
    dayCount: period.dayCount,
    affirmation,
    pepTalks: PEP_TALKS,
    supporting,
    highlights,
    sports,
    heart: heartStats(exercises)
  };
}
