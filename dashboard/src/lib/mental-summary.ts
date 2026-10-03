import { localDateKey } from "./dates";
import type { DigitalCounts, MentalPlatformShare, MentalSummary, Platform } from "./types";

const PEP_TALKS = [
  "Great work!",
  "You protected your attention.",
  "That's a boundary.",
  "You noticed the feed.",
  "Good call on the blur.",
  "Your mind got a filter.",
  "That's you, in charge.",
  "Keep that space."
];

const PLATFORM_LABEL: Record<Platform, string> = {
  facebook: "Facebook",
  twitter: "Twitter / X"
};

function pct(value: number | null): string {
  return value == null ? "—" : `${Math.round(value * 100)}%`;
}

function loadVerdict(recent: DigitalCounts, baseline: DigitalCounts): { verdict: string; detail: string } {
  if (!recent.classified && !recent.hidden) {
    return {
      verdict: "No feed signal yet.",
      detail: "Pair the extension and scroll a little. Counts stay on this machine, without post text."
    };
  }

  const negativity = recent.negativityRate;
  const baselineNeg = baseline.negativityRate;
  const reveal = recent.revealRate ?? 0;

  if (negativity != null && negativity >= 0.5 && reveal < 0.2) {
    return {
      verdict: "A heavy feed, and you let the filter hold.",
      detail: `${pct(negativity)} of classified posts were draining. You peeked at ${recent.revealed} of ${recent.hidden} blurred ones.`
    };
  }
  if (negativity != null && negativity >= 0.5) {
    return {
      verdict: "A heavy feed, and you peeked at some of it.",
      detail: `${recent.hidden} posts were blurred. You revealed ${recent.revealed} - curiosity, not a failure.`
    };
  }
  if (negativity != null && baselineNeg != null && negativity <= baselineNeg - 0.08) {
    return {
      verdict: "The feed was gentler than your usual mix.",
      detail: `Negativity sat at ${pct(negativity)} versus ${pct(baselineNeg)} over the longer stretch.`
    };
  }
  if (reveal >= 0.3 && recent.hidden >= 4) {
    return {
      verdict: "You checked a lot of the blurred posts.",
      detail: `${pct(recent.revealRate)} reveal rate on ${recent.hidden} hidden posts. The filter still did the first pass.`
    };
  }
  if (negativity != null && negativity <= 0.25) {
    return {
      verdict: "A relatively kind stretch of scrolling.",
      detail: `${recent.classified} posts classified, ${recent.negative} flagged as draining.`
    };
  }
  return {
    verdict: "A steady mix of protection and curiosity.",
    detail: `${recent.hidden} blurred, ${recent.revealed} revealed, ${pct(negativity)} of the classified feed marked draining.`
  };
}

function affirmationFor(verdict: string, recent: DigitalCounts): string {
  if (!recent.classified && !recent.hidden) {
    return "Your attention is still yours to shape.";
  }
  if (verdict.includes("filter hold")) {
    return "You did not have to take all of that in.";
  }
  if (verdict.includes("peeked")) {
    return "Looking once is not the same as living in it.";
  }
  if (verdict.includes("gentler")) {
    return "Lighter input is allowed to count.";
  }
  if (verdict.includes("checked a lot")) {
    return "You can look, and you can also look away.";
  }
  if (verdict.includes("kind stretch")) {
    return "A quieter feed is a kind of rest.";
  }
  return "You noticed what the feed asked of you.";
}

function supportingLine(recent: DigitalCounts, platforms: MentalPlatformShare[]): string {
  if (!recent.classified && !recent.hidden) {
    return "Nothing stored for this profile yet.";
  }
  const names = platforms
    .filter((item) => item.counts.classified + item.counts.hidden > 0)
    .map((item) => item.label);
  const from = names.length ? ` from ${names.join(" and ")}` : "";
  return `${recent.classified} posts classified${from}. ${recent.hidden} were blurred; ${recent.revealed} you chose to open.`;
}

export function computeMentalSummary(
  last3Days: DigitalCounts,
  last14Days: DigitalCounts,
  platforms: MentalPlatformShare[]
): MentalSummary {
  const load = loadVerdict(last3Days, last14Days);
  const today = localDateKey();
  return {
    periodLabel: "Last 3 days vs your 14-day mix",
    asOf: today,
    pepTalks: PEP_TALKS,
    affirmation: affirmationFor(load.verdict, last3Days),
    supporting: supportingLine(last3Days, platforms),
    load: {
      verdict: load.verdict,
      verdictDetail: load.detail,
      ...last3Days
    },
    last3Days,
    last14Days,
    platforms
  };
}

export { PLATFORM_LABEL };
