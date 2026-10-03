import { PepTalk } from "@/components/pep-talk";
import { formatMinutes } from "@/lib/dates";
import type { HeartZoneStats, PhysicalSummary } from "@/lib/types";

export function PhysicalRecap({ summary }: { summary: PhysicalSummary }) {
  if (!summary.dayCount && !summary.highlights.length) {
    return (
      <p className="mt-10 rounded-3xl bg-white/70 px-5 py-6 text-[#7a746b]">
        Nothing stored yet. Upload a health ZIP in Settings.
      </p>
    );
  }

  const maxMinutes = Math.max(1, ...summary.sports.map((sport) => sport.minutes));

  return (
    <>
      <section className="mt-10">
        <p className="text-xs tracking-[0.22em] text-[#7a746b]">THIS STRETCH</p>
        <PepTalk lines={summary.pepTalks} />
        <h2 className="serif mt-3 max-w-3xl text-4xl leading-tight md:text-5xl">{summary.affirmation}</h2>
        <p className="mt-4 max-w-2xl text-[#7a746b]">{summary.supporting}</p>
      </section>

      {summary.heart ? <HeartZoneBanner heart={summary.heart} /> : null}

      {summary.highlights.length ? (
        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {summary.highlights.map((item) => (
            <article key={item.label} className="rounded-3xl bg-white/70 p-6">
              <p className="text-[11px] tracking-[0.16em] text-[#7a746b]">{item.label}</p>
              <p className="serif mt-2 text-4xl">{item.value}</p>
              <p className="mt-3 text-sm text-[#7a746b]">{item.detail}</p>
            </article>
          ))}
        </section>
      ) : null}

      {summary.sports.length ? (
        <section className="mt-10">
          <article className="rounded-3xl bg-white/70 p-6">
            <p className="text-[11px] tracking-[0.16em] text-[#7a746b]">SPORT MIX</p>
            <ul className="mt-5 flex flex-col gap-4">
              {summary.sports.map((sport) => (
                <li key={sport.sport}>
                  <div className="flex items-end justify-between gap-3">
                    <p>{sport.sport}</p>
                    <p className="text-sm text-[#7a746b]">
                      {sport.count} · {sport.minutes} min
                      {sport.distanceKm != null
                        ? ` · ${sport.distanceKm.toFixed(sport.distanceKm >= 10 ? 0 : 1)} km`
                        : ""}
                    </p>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#efe8dc]">
                    <div
                      className="h-full rounded-full bg-[#cbb8f3]"
                      style={{ width: `${(sport.minutes / maxMinutes) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </article>
        </section>
      ) : null}
    </>
  );
}

function HeartZoneBanner({ heart }: { heart: HeartZoneStats }) {
  const total = heart.lowSeconds + heart.midSeconds + heart.highSeconds || 1;

  return (
    <section className="mt-8 rounded-[28px] bg-[#efe8ff] p-6 md:p-7">
      <p className="text-[11px] tracking-[0.16em] text-[#7a746b]">HEART-RATE INTENSITY</p>
      <h3 className="serif mt-2 text-3xl md:text-4xl">{heart.verdict}</h3>
      <p className="mt-2 max-w-2xl text-[#7a746b]">{heart.verdictDetail}</p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <article className="rounded-3xl bg-white/80 p-5">
          <p className="text-[11px] tracking-[0.16em] text-[#7a746b]">LOW ZONE · UNDER 70% MAX HR</p>
          <p className="serif mt-2 text-4xl">{formatMinutes(heart.lowSeconds)}</p>
          <p className="mt-2 text-sm text-[#7a746b]">
            {heart.lowSessions} easy session{heart.lowSessions === 1 ? "" : "s"}
          </p>
        </article>
        <article className="rounded-3xl bg-white/80 p-5">
          <p className="text-[11px] tracking-[0.16em] text-[#7a746b]">HIGH ZONE · 80%+ MAX HR</p>
          <p className="serif mt-2 text-4xl">{formatMinutes(heart.highSeconds)}</p>
          <p className="mt-2 text-sm text-[#7a746b]">
            {heart.highSessions} high-intensity session{heart.highSessions === 1 ? "" : "s"}
          </p>
        </article>
      </div>

      <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-white/70">
        <div className="h-full bg-[#cbb8f3]" style={{ width: `${(heart.lowSeconds / total) * 100}%` }} />
        <div className="h-full bg-[#f6d35c]" style={{ width: `${(heart.midSeconds / total) * 100}%` }} />
        <div className="h-full bg-[#8d74d6]" style={{ width: `${(heart.highSeconds / total) * 100}%` }} />
      </div>
      <p className="mt-3 text-sm text-[#7a746b]">
        Low · easy aerobic · {formatMinutes(heart.lowSeconds)}
        {heart.midSeconds ? ` · moderate ${formatMinutes(heart.midSeconds)}` : ""}
        {` · high ${formatMinutes(heart.highSeconds)}`}
      </p>
    </section>
  );
}
