import { affirmationFor } from "./affirmations";
import { formatLongDate } from "./dates";
import { getDigitalCounts, getPhysicalPayload } from "./queries";
import { getMeta } from "./db";
import type { DataSource, Insight, OverviewPayload, RechargeNight } from "./types";

const DISCLAIMER =
  "Browsing protection plus local Polar or demo health data. This is not a mental-health assessment.";

function rechargeScore(night: RechargeNight | undefined): number | null {
  if (!night) return null;
  if (night.ansCharge != null) return Math.max(0, Math.min(1, night.ansCharge / 100));
  const status = String(night.status || "").toLowerCase();
  if (status.includes("poor") || status.includes("low")) return 0.25;
  if (status.includes("good") || status.includes("solid")) return 0.85;
  if (status.includes("ok") || status.includes("average") || status.includes("fair")) {
    return 0.55;
  }
  return null;
}

function delta(current: number | null, baseline: number | null): number | null {
  if (current == null || baseline == null || baseline === 0) return null;
  return (current - baseline) / baseline;
}

function labelHours(hours: number | null): string {
  if (hours == null) return "No recent activity on record";
  if (hours < 18) return "Recent activity";
  if (hours < 48) return "Moderate activity recently";
  return "Low recent activity";
}

function labelRecovery(score: number | null, hoursSinceWorkout: number | null): string {
  if (score == null && hoursSinceWorkout == null) return "Recovery data not in yet";
  if (score != null && score < 0.4) return "Low recovery after last activity";
  if (hoursSinceWorkout != null && hoursSinceWorkout >= 48) {
    return "Low recovery after last activity";
  }
  if (score != null && score >= 0.7) return "Solid recovery after last activity";
  return "Steady recovery after last activity";
}

export function computeInsight(): Insight {
  const digital3 = getDigitalCounts(3);
  const digital14 = getDigitalCounts(14);
  const physical = getPhysicalPayload();
  const latestRecharge = physical.rechargeNights[0];
  const recharge = rechargeScore(latestRecharge);

  const negativity = digital3.negativityRate;
  const baselineNegativity = digital14.negativityRate;
  const reveal = digital3.revealRate;
  const sleepDelta = delta(physical.recentSleepHours, physical.baselineSleepHours);
  const hoursSinceWorkout = physical.hoursSinceWorkout;

  const workouts7d = physical.exercises.filter((item) => {
    return Date.now() - new Date(item.startTime).getTime() <= 7 * 24 * 36e5;
  }).length;
  const workouts14d = physical.exercises.filter((item) => {
    return Date.now() - new Date(item.startTime).getTime() <= 14 * 24 * 36e5;
  }).length;
  const typicalWeekly = workouts14d / 2;
  const typicalGapHours = workouts14d > 0 ? (14 * 24) / workouts14d : null;
  const staleWorkout =
    hoursSinceWorkout != null &&
    (typicalGapHours != null
      ? hoursSinceWorkout > typicalGapHours * 1.35
      : hoursSinceWorkout >= 60);

  const highNegativity =
    negativity != null &&
    (negativity >= (baselineNegativity ?? negativity) + 0.08 || negativity >= 0.5);
  const highReveal = reveal != null && reveal >= 0.22;
  const lowRecharge = recharge != null && recharge < 0.4;
  const poorSleep = sleepDelta != null && sleepDelta <= -0.1;
  const recentActivity =
    hoursSinceWorkout != null &&
    (typicalGapHours != null
      ? hoursSinceWorkout <= typicalGapHours * 0.9
      : hoursSinceWorkout <= 36);
  const lowNegativity = negativity != null && negativity <= (baselineNegativity ?? 0.4);
  const easyBody = lowRecharge || staleWorkout;

  let headline = "Check in with both sides today.";
  if (easyBody) {
    headline = "Take it easy today.";
  } else if (highNegativity && highReveal) {
    headline = "Protect your attention today.";
  } else if (poorSleep && (highNegativity || highReveal)) {
    headline = "Give your mind a quieter feed today.";
  } else if (lowNegativity && (recentActivity || (sleepDelta != null && sleepDelta >= -0.04))) {
    headline = "You have a solid baseline today.";
  }

  const digitalNote = `${digital3.hidden} harmful posts blocked in the last 3 days · ${digital3.revealed} posts revealed.`;
  const sleepNote =
    physical.recentSleepHours == null
      ? "Sleep not in yet."
      : `Recent nights average ${physical.recentSleepHours.toFixed(1)}h` +
        (physical.baselineSleepHours
          ? ` vs your 14-day ${physical.baselineSleepHours.toFixed(1)}h.`
          : ".");
  const workoutNote =
    hoursSinceWorkout == null
      ? "No workout on record."
      : `Last activity was ${Math.round(hoursSinceWorkout)} hours ago.`;

  const summary = [headline.replace(/\.$/, ""), sleepNote, workoutNote].join(" ");

  return {
    headline,
    summary,
    disclaimer: `${DISCLAIMER} ${digitalNote}`,
    affirmation: affirmationFor(headline),
    recoveryLabel: labelRecovery(recharge, hoursSinceWorkout),
    activityLabel: labelHours(hoursSinceWorkout),
    signals: {
      negativityRate3d: negativity,
      negativityRate14d: baselineNegativity,
      revealRate3d: reveal,
      sleepHours3d: physical.recentSleepHours,
      sleepHours14d: physical.baselineSleepHours,
      sleepDelta,
      hoursSinceWorkout,
      workouts7d,
      workouts14d,
      typicalWeekly,
      recharge
    }
  };
}

export function getOverviewPayload(): OverviewPayload {
  const digital3 = getDigitalCounts(3);
  return {
    dateLabel: formatLongDate(),
    blockedLast3Days: digital3.hidden,
    revealedLast3Days: digital3.revealed,
    dataSource: (getMeta("data_source") as DataSource | null) ?? null,
    lastExtensionEvent: getMeta("last_extension_event"),
    lastPolarSync: getMeta("last_polar_sync"),
    insight: computeInsight()
  };
}
