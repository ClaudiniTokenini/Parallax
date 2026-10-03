import { AppShell } from "@/components/app-shell";
import { AutoRefresh } from "@/components/auto-refresh";
import { OverviewHero } from "@/components/overview-hero";
import { PlayButton } from "@/components/play-button";
import { getRequestUser } from "@/lib/auth";
import { getOverviewPayload } from "@/lib/insight-engine";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const user = await getRequestUser();
  const data = getOverviewPayload(user.id);

  return (
    <AppShell current="/">
      <AutoRefresh />
      <section className="pt-4">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
          <div>
            <p className="text-xs tracking-[0.22em] text-[#7a746b]">AFFIRMATION FOR THE DAY</p>
            <h1 className="serif mt-3 max-w-xl text-5xl leading-tight md:text-5xl">
              {data.insight.affirmation}
            </h1>
            <PlayButton />
          </div>
          <p className="pt-2 text-sm text-[#7a746b]">{data.dateLabel}</p>
        </div>

        <OverviewHero
          blocked={{
            label: "POST STATS / BLOCKED",
            value: String(data.blockedLast3Days),
            detail: "harmful posts blocked in the last 3 days"
          }}
          revealed={{
            label: "POST STATS / REVEALED",
            value: String(data.revealedLast3Days),
            detail: "posts revealed"
          }}
          recovery={{
            label: "HEALTH / RECOVERY",
            value: shortLabel(data.insight.recoveryLabel),
            detail: data.insight.recoveryLabel
          }}
          activity={{
            label: "HEALTH / ACTIVITY",
            value: shortLabel(data.insight.activityLabel),
            detail: data.insight.activityLabel
          }}
        />

        <div className="mx-auto mt-6 max-w-2xl text-center md:mt-2">
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
  if (/not in yet/i.test(value)) return "Not in yet";
  if (/No recent activity/i.test(value)) return "No activity";
  if (/low recovery/i.test(value)) return "Low recovery";
  if (/solid recovery/i.test(value)) return "Solid recovery";
  if (/steady recovery/i.test(value)) return "Steady recovery";
  if (/low recent/i.test(value)) return "Low activity";
  if (/Recent activity/i.test(value)) return "Recent activity";
  if (/Moderate activity/i.test(value)) return "Moderate activity";
  if (/Active stretch/i.test(value)) return "Active stretch";
  if (/Steady steps/i.test(value)) return "Steady steps";
  if (/Moderate steps/i.test(value)) return "Moderate steps";
  if (/Quiet step/i.test(value)) return "Quiet steps";
  if (/Sessions in the import/i.test(value)) return "Sessions logged";
  return value;
}
