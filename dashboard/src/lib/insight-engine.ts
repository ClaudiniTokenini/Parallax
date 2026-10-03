import { getUserById, getSoloUser } from "./auth";
import { affirmationFor } from "./affirmations";
import { formatLongDate } from "./dates";
import { getDigitalCounts, getPhysicalPayload } from "./queries";
import { getMeta } from "./db";
import type {
  DataSource,
  DigitalCounts,
  Insight,
  OverviewPayload,
  PhysicalPayload,
  RechargeNight
} from "./types";

const DISCLAIMER =
  "Browsing protection plus local health data.";

type Facts = {
  hasFeed: boolean;
  heavyFeed: boolean;
  peeked: boolean;
  heldFilter: boolean;
  quietFeed: boolean;
  lighterThanUsual: boolean;
  hasSleep: boolean;
  hasWorkout: boolean;
  hasSteps: boolean;
  hasPhysical: boolean;
  physicalFresh: boolean;
  shortSleep: boolean;
  solidSleep: boolean;
  staleWorkout: boolean;
  recentWorkout: boolean;
  lowSteps: boolean;
  activeStretch: boolean;
  tiredBody: boolean;
  hotHeart: boolean;
  hidden: number;
  revealed: number;
  classified: number;
  workouts7d: number;
  workouts14d: number;
  typicalWeekly: number;
  hoursSinceWorkout: number | null;
  sleepHours: number | null;
  sleepBaseline: number | null;
  sleepDelta: number | null;
  recharge: number | null;
  averageSteps: number | null;
};

type Rule = {
  id: string;
  headline: string;
  when: (facts: Facts) => boolean;
  summary: (facts: Facts) => string;
};

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

function daysSince(dateValue: string | null | undefined): number | null {
  if (!dateValue) return null;
  const stamp = dateValue.length <= 10 ? `${dateValue}T12:00:00` : dateValue;
  const then = new Date(stamp);
  if (Number.isNaN(then.getTime())) return null;
  return Math.max(0, (Date.now() - then.getTime()) / 864e5);
}

function feedNote(facts: Facts): string {
  if (!facts.hasFeed) return "No feed events in the last 3 days.";
  if (facts.heldFilter && facts.hidden) {
    return `${facts.hidden} draining post${facts.hidden === 1 ? "" : "s"} blurred in the last 3 days, and you left ${
      facts.hidden === 1 ? "it" : "them"
    } covered.`;
  }
  if (facts.peeked) {
    return `The filter caught ${facts.hidden} post${facts.hidden === 1 ? "" : "s"}; you opened ${facts.revealed}.`;
  }
  if (facts.quietFeed) {
    return `A lighter scroll: ${facts.classified} posts classified, ${facts.hidden} blurred.`;
  }
  return `${facts.hidden} harmful posts blocked in the last 3 days · ${facts.revealed} revealed.`;
}

function bodyNote(facts: Facts): string {
  if (!facts.hasPhysical) return "Health ZIP is not loaded yet.";

  const bits: string[] = [];
  if (facts.sleepHours != null) {
    bits.push(
      facts.physicalFresh
        ? `Recent nights average ${facts.sleepHours.toFixed(1)}h` +
            (facts.sleepBaseline ? ` vs your ${facts.sleepBaseline.toFixed(1)}h stretch.` : ".")
        : `Sleep in this import averages ${facts.sleepHours.toFixed(1)}h.`
    );
  }
  if (facts.physicalFresh && facts.hoursSinceWorkout != null) {
    bits.push(`Last training session was ${Math.round(facts.hoursSinceWorkout)} hours ago.`);
  } else if (facts.hasWorkout) {
    bits.push(
      facts.workouts14d === 1
        ? "This import has 1 training session."
        : `This import has ${facts.workouts14d} training sessions.`
    );
  }
  if (facts.averageSteps != null && !facts.hasWorkout) {
    bits.push(`About ${facts.averageSteps.toLocaleString("en-GB")} steps a day in the log.`);
  }
  return bits.join(" ") || "Health data is in, but sleep and sessions are thin.";
}

function joinNotes(mental: string, physical: string): string {
  return `${mental} ${physical}`.replace(/\s+/g, " ").trim();
}

const RULES: Rule[] = [
  {
    id: "heavy-feed-tired-body",
    headline: "Give your mind a quieter feed today.",
    when: (facts) => facts.heavyFeed && facts.tiredBody,
    summary: (facts) =>
      joinNotes(
        "The feed was draining, and your body looks run down.",
        `${feedNote(facts)} ${bodyNote(facts)}`
      )
  },
  {
    id: "heavy-feed-peeked",
    headline: "Protect your attention today.",
    when: (facts) => facts.heavyFeed && facts.peeked,
    summary: (facts) =>
      joinNotes("You opened some of the blurred posts.", `${feedNote(facts)} ${bodyNote(facts)}`)
  },
  {
    id: "heavy-feed-held",
    headline: "You let the filter hold today.",
    when: (facts) => facts.heavyFeed && facts.heldFilter,
    summary: (facts) => joinNotes(feedNote(facts), bodyNote(facts))
  },
  {
    id: "heavy-feed-only",
    headline: "The feed asked a lot today.",
    when: (facts) => facts.heavyFeed,
    summary: (facts) => joinNotes(feedNote(facts), bodyNote(facts))
  },
  {
    id: "tired-body",
    headline: "Take it easy today.",
    when: (facts) => facts.tiredBody,
    summary: (facts) =>
      joinNotes("Your body side is asking for a lighter day.", `${bodyNote(facts)} ${feedNote(facts)}`)
  },
  {
    id: "solid-both",
    headline: "You have a solid baseline today.",
    when: (facts) =>
      facts.hasPhysical &&
      (facts.solidSleep || facts.activeStretch) &&
      (facts.quietFeed || facts.lighterThanUsual || !facts.hasFeed),
    summary: (facts) =>
      joinNotes("Sleep, movement, and the feed are lining up.", `${bodyNote(facts)} ${feedNote(facts)}`)
  },
  {
    id: "quiet-feed",
    headline: "You have a solid baseline today.",
    when: (facts) => facts.hasPhysical && (facts.quietFeed || facts.lighterThanUsual),
    summary: (facts) => joinNotes("The feed was gentler than it can be.", `${feedNote(facts)} ${bodyNote(facts)}`)
  },
  {
    id: "check-in",
    headline: "Check in with both sides today.",
    when: () => true,
    summary: (facts) => joinNotes(feedNote(facts), bodyNote(facts))
  }
];

function buildFacts(digital3: DigitalCounts, digital14: DigitalCounts, physical: PhysicalPayload): Facts {
  const recharge = rechargeScore(physical.rechargeNights[0]);
  const sleepHours = physical.recentSleepHours;
  const sleepBaseline = physical.baselineSleepHours;
  const sleepDelta = delta(sleepHours, sleepBaseline);
  const hoursSinceWorkout = physical.hoursSinceWorkout;
  const workouts7d = physical.exercises.filter(
    (item) => Date.now() - new Date(item.startTime).getTime() <= 7 * 24 * 36e5
  ).length;
  const workouts14d = physical.exercises.filter(
    (item) => Date.now() - new Date(item.startTime).getTime() <= 14 * 24 * 36e5
  ).length;
  const stretchWorkouts = workouts14d || physical.exercises.length;
  const typicalWeekly = stretchWorkouts / 2;
  const typicalGapHours = stretchWorkouts > 0 ? (14 * 24) / stretchWorkouts : null;

  const lastHealthDays = [
    daysSince(physical.lastWorkout?.startTime),
    daysSince(physical.sleepNights[0]?.date),
    daysSince(physical.lastActivityDate)
  ].filter((value): value is number => value != null);
  const physicalFresh = lastHealthDays.length > 0 && Math.min(...lastHealthDays) <= 7;

  const hasFeed = digital3.classified + digital3.hidden + digital3.revealed > 0;
  const negativity = digital3.negativityRate;
  const baselineNegativity = digital14.negativityRate;
  const reveal = digital3.revealRate;
  const hidden = digital3.hidden;
  const revealed = digital3.revealed;

  const heavyFeed =
    hasFeed &&
    ((negativity != null &&
      (negativity >= 0.5 ||
        (baselineNegativity != null &&
          negativity >= baselineNegativity + 0.08 &&
          negativity >= 0.35))) ||
      (negativity == null && hidden >= 3));
  const peeked = hidden >= 1 && revealed >= 1 && (reveal ?? 0) >= 0.22;
  const heldFilter = hidden >= 1 && (reveal == null || reveal < 0.22);
  const quietFeed = hasFeed && negativity != null && negativity <= 0.25 && hidden <= 2;
  const lighterThanUsual =
    negativity != null && baselineNegativity != null && negativity <= baselineNegativity - 0.08;

  const hasSleep = sleepHours != null;
  const hasWorkout = physical.exercises.length > 0;
  const hasSteps = physical.averageSteps != null;
  const hasPhysical = hasSleep || hasWorkout || hasSteps || physical.rechargeNights.length > 0;
  const shortSleep =
    (sleepHours != null && sleepHours < 6.5) || (sleepDelta != null && sleepDelta <= -0.1);
  const solidSleep = sleepHours != null && sleepHours >= 7 && (sleepDelta == null || sleepDelta >= -0.04);
  const staleWorkout =
    physicalFresh &&
    hoursSinceWorkout != null &&
    (typicalGapHours != null ? hoursSinceWorkout > typicalGapHours * 1.35 : hoursSinceWorkout >= 60);
  const recentWorkout =
    physicalFresh &&
    hoursSinceWorkout != null &&
    (typicalGapHours != null ? hoursSinceWorkout <= typicalGapHours * 0.9 : hoursSinceWorkout <= 36);
  const lowSteps = physical.averageSteps != null && physical.averageSteps < 4500;
  const hotHeart = Boolean(physical.summary.heart?.verdict.toLowerCase().includes("ran hot"));
  const activeStretch =
    recentWorkout || stretchWorkouts >= 3 || (physical.averageSteps != null && physical.averageSteps >= 7000);
  const tiredBody =
    hasPhysical && (shortSleep || staleWorkout || (recharge != null && recharge < 0.4) || (lowSteps && !activeStretch) || hotHeart);

  return {
    hasFeed,
    heavyFeed,
    peeked,
    heldFilter,
    quietFeed,
    lighterThanUsual,
    hasSleep,
    hasWorkout,
    hasSteps,
    hasPhysical,
    physicalFresh,
    shortSleep,
    solidSleep,
    staleWorkout,
    recentWorkout,
    lowSteps,
    activeStretch,
    tiredBody,
    hotHeart,
    hidden,
    revealed,
    classified: digital3.classified,
    workouts7d,
    workouts14d: stretchWorkouts,
    typicalWeekly,
    hoursSinceWorkout,
    sleepHours,
    sleepBaseline,
    sleepDelta,
    recharge,
    averageSteps: physical.averageSteps
  };
}

function pickRule(facts: Facts): Rule {
  return RULES.find((rule) => rule.when(facts)) || RULES[RULES.length - 1];
}

function recoveryLabel(facts: Facts): string {
  if (!facts.hasPhysical) return "Recovery data not in yet";
  if (facts.recharge != null && facts.recharge < 0.4) return "Low recovery after last activity";
  if (facts.shortSleep) return "Low recovery after last activity";
  if (facts.staleWorkout) return "Low recovery after last activity";
  if ((facts.recharge != null && facts.recharge >= 0.7) || facts.solidSleep) {
    return "Solid recovery after last activity";
  }
  if (facts.hasSleep || facts.recharge != null) return "Steady recovery after last activity";
  return "Recovery data not in yet";
}

function activityLabel(facts: Facts): string {
  if (facts.physicalFresh && facts.hoursSinceWorkout != null) {
    if (facts.hoursSinceWorkout < 18) return "Recent activity";
    if (facts.hoursSinceWorkout < 48) return "Moderate activity recently";
    return "Low recent activity";
  }
  if (facts.activeStretch) return "Active stretch in the log";
  if (facts.averageSteps != null) {
    if (facts.averageSteps >= 7000) return "Steady steps";
    if (facts.averageSteps >= 4000) return "Moderate steps";
    return "Quiet step days";
  }
  if (facts.hasWorkout) return "Sessions in the import";
  return "No recent activity on record";
}

export function computeInsight(userId?: string): Insight {
  const digital3 = getDigitalCounts(3, userId);
  const digital14 = getDigitalCounts(14, userId);
  const physical = getPhysicalPayload(userId);
  const facts = buildFacts(digital3, digital14, physical);
  const rule = pickRule(facts);
  const digitalNote = `${digital3.hidden} harmful posts blocked in the last 3 days · ${digital3.revealed} posts revealed.`;

  return {
    headline: rule.headline,
    summary: rule.summary(facts),
    disclaimer: `${DISCLAIMER} ${digitalNote}`,
    affirmation: affirmationFor(rule.headline),
    recoveryLabel: recoveryLabel(facts),
    activityLabel: activityLabel(facts),
    ruleId: rule.id,
    signals: {
      negativityRate3d: digital3.negativityRate,
      negativityRate14d: digital14.negativityRate,
      revealRate3d: digital3.revealRate,
      sleepHours3d: facts.sleepHours,
      sleepHours14d: facts.sleepBaseline,
      sleepDelta: facts.sleepDelta,
      hoursSinceWorkout: facts.hoursSinceWorkout,
      workouts7d: facts.workouts7d,
      workouts14d: facts.workouts14d,
      typicalWeekly: facts.typicalWeekly,
      recharge: facts.recharge,
      averageSteps: facts.averageSteps,
      heavyFeed: facts.heavyFeed ? 1 : 0,
      tiredBody: facts.tiredBody ? 1 : 0,
      hasPhysical: facts.hasPhysical ? 1 : 0
    }
  };
}

export function getOverviewPayload(userId?: string): OverviewPayload {
  const user = (userId ? getUserById(userId) : null) ?? getSoloUser();
  const digital3 = getDigitalCounts(3, user.id);
  return {
    dateLabel: formatLongDate(),
    blockedLast3Days: digital3.hidden,
    revealedLast3Days: digital3.revealed,
    dataSource: (getMeta("data_source") as DataSource | null) ?? null,
    lastExtensionEvent: user.lastExtensionEvent,
    lastPolarSync: user.lastHealthImport,
    insight: computeInsight(user.id)
  };
}
