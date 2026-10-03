import { AppShell } from "@/components/app-shell";
import { AutoRefresh } from "@/components/auto-refresh";
import { PlayButton } from "@/components/play-button";
import { SunMoon } from "@/components/sun-moon";
import { getOverviewPayload } from "@/lib/insight-engine";

export const dynamic = "force-dynamic";

export default function OverviewPage() {
  const data = getOverviewPayload();

  return (
    <AppShell current="/">
      <AutoRefresh />
      <section className="pt-4">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
          <div>
            <p className="text-xs tracking-[0.22em] text-[#7a746b]">AFFIRMATION FOR THE DAY</p>
            <h1 className="serif mt-3 max-w-xl text-5xl leading-tight md:text-6xl">
              {data.insight.affirmation}
            </h1>
            <PlayButton />
          </div>
          <p className="pt-2 text-sm text-[#7a746b]">{data.dateLabel}</p>
        </div>

        <div className="mt-10 grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr]">
          <div className="space-y-16">
            <Metric
              label="POST STATS / BLOCKED"
              value={String(data.blockedLast3Days)}
              detail="harmful posts blocked in the last 3 days"
              side="left"
            />
            <Metric
              label="POST STATS / REVEALED"
              value={String(data.revealedLast3Days)}
              detail="posts revealed"
              side="left"
            />
          </div>
          <SunMoon />
          <div className="space-y-16">
            <Metric
              label="HEALTH / RECOVERY"
              value={shortLabel(data.insight.recoveryLabel)}
              detail={data.insight.recoveryLabel}
              side="right"
            />
            <Metric
              label="HEALTH / ACTIVITY"
              value={shortLabel(data.insight.activityLabel)}
              detail={data.insight.activityLabel}
              side="right"
            />
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-2xl text-center">
          <p className="text-xs tracking-[0.18em] text-[#7a746b]">
            RESULT FROM POST STATS + HEALTH DATA
          </p>
          <h2 className="serif mt-3 text-5xl">{data.insight.headline}</h2>
          <p className="mt-4 text-[#7a746b]">{data.insight.summary}</p>
          <p className="mt-3 text-sm text-[#9a9388]">{data.insight.disclaimer}</p>
        </div>
      </section>
    </AppShell>
  );
}

function shortLabel(value: string): string {
  if (/low recovery/i.test(value)) return "Low recovery";
  if (/solid recovery/i.test(value)) return "Solid recovery";
  if (/steady recovery/i.test(value)) return "Steady recovery";
  if (/low recent/i.test(value)) return "Low activity";
  if (/Recent activity/i.test(value)) return "Recent activity";
  if (/Moderate/i.test(value)) return "Moderate activity";
  return value;
}

function Metric({
  label,
  value,
  detail,
  side
}: {
  label: string;
  value: string;
  detail: string;
  side: "left" | "right";
}) {
  return (
    <div className={side === "right" ? "lg:text-right" : ""}>
      <p className="text-[11px] tracking-[0.18em] text-[#7a746b]">{label}</p>
      <p className="serif mt-2 text-4xl">{value}</p>
      <p className="mt-2 max-w-xs text-sm text-[#7a746b] lg:inline-block">{detail}</p>
    </div>
  );
}
