import { PepTalk } from "@/components/pep-talk";
import type { DigitalCounts, MentalLoad, MentalSummary } from "@/lib/types";

export function MentalRecap({ summary }: { summary: MentalSummary }) {
  const empty = !summary.last3Days.classified && !summary.last3Days.hidden;

  if (empty) {
    return (
      <p className="mt-10 rounded-3xl bg-white/70 px-5 py-6 text-[#7a746b]">
        Nothing stored yet. Pair the browser extension in Settings, then keep scrolling. Post text
        never leaves the classifier.
      </p>
    );
  }

  return (
    <>
      <section className="mt-10">
        <p className="text-xs tracking-[0.22em] text-[#7a746b]">{summary.periodLabel.toUpperCase()}</p>
        <PepTalk lines={summary.pepTalks} />
        <h2 className="serif mt-3 max-w-3xl text-4xl leading-tight md:text-5xl">{summary.affirmation}</h2>
        <p className="mt-4 max-w-2xl text-[#7a746b]">{summary.supporting}</p>
      </section>

      <FeedLoadBanner load={summary.load} />

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <WindowCard title="Last 3 days" counts={summary.last3Days} />
        <WindowCard title="Last 14 days / baseline" counts={summary.last14Days} />
      </section>

      {summary.platforms.length ? (
        <section className="mt-10">
          <article className="rounded-3xl bg-white/70 p-6">
            <p className="text-[11px] tracking-[0.16em] text-[#7a746b]">BY PLATFORM · LAST 3 DAYS</p>
            <ul className="mt-5 flex flex-col gap-5">
              {summary.platforms.map((item) => (
                <li key={item.platform}>
                  <div className="flex items-end justify-between gap-3">
                    <p>{item.label}</p>
                    <p className="text-sm text-[#7a746b]">
                      {item.counts.classified} classified · {pct(item.counts.negativityRate)} draining
                    </p>
                  </div>
                  <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-[#efe8dc]">
                    <div
                      className="h-full bg-[#8d74d6]"
                      style={{ width: `${barShare(item.counts.negative, item.counts.classified)}%` }}
                    />
                    <div
                      className="h-full bg-[#cbb8f3]"
                      style={{
                        width: `${barShare(
                          Math.max(0, item.counts.classified - item.counts.negative),
                          item.counts.classified
                        )}%`
                      }}
                    />
                  </div>
                  <p className="mt-2 text-sm text-[#7a746b]">
                    {item.counts.hidden} blurred · {item.counts.revealed} revealed
                  </p>
                </li>
              ))}
            </ul>
          </article>
        </section>
      ) : null}
    </>
  );
}

function FeedLoadBanner({ load }: { load: MentalLoad }) {
  const total = load.hidden + load.revealed || 1;

  return (
    <section className="mt-8 rounded-[28px] bg-[#efe8ff] p-6 md:p-7">
      <p className="text-[11px] tracking-[0.16em] text-[#7a746b]">FEED LOAD · LAST 3 DAYS</p>
      <h3 className="serif mt-2 text-3xl md:text-4xl">{load.verdict}</h3>
      <p className="mt-2 max-w-2xl text-[#7a746b]">{load.verdictDetail}</p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <article className="rounded-3xl bg-white/80 p-5">
          <p className="text-[11px] tracking-[0.16em] text-[#7a746b]">PROTECTED · BLURRED</p>
          <p className="serif mt-2 text-4xl">{load.hidden}</p>
          <p className="mt-2 text-sm text-[#7a746b]">
            {load.negative} draining of {load.classified} classified
          </p>
        </article>
        <article className="rounded-3xl bg-white/80 p-5">
          <p className="text-[11px] tracking-[0.16em] text-[#7a746b]">PEEKED · REVEALED</p>
          <p className="serif mt-2 text-4xl">{load.revealed}</p>
          <p className="mt-2 text-sm text-[#7a746b]">
            {pct(load.revealRate)} of blurred posts opened
          </p>
        </article>
      </div>

      <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-white/70">
        <div className="h-full bg-[#cbb8f3]" style={{ width: `${(load.hidden / total) * 100}%` }} />
        <div className="h-full bg-[#8d74d6]" style={{ width: `${(load.revealed / total) * 100}%` }} />
      </div>
      <p className="mt-3 text-sm text-[#7a746b]">
        Blurred {load.hidden} · revealed {load.revealed} · negativity {pct(load.negativityRate)}
      </p>
    </section>
  );
}

function WindowCard({ title, counts }: { title: string; counts: DigitalCounts }) {
  return (
    <div className="rounded-3xl bg-white/70 p-6">
      <p className="text-[11px] tracking-[0.16em] text-[#7a746b]">{title}</p>
      <dl className="mt-5 grid grid-cols-2 gap-4">
        <Stat label="Classified" value={counts.classified} />
        <Stat label="Negative" value={counts.negative} />
        <Stat label="Hidden" value={counts.hidden} />
        <Stat label="Revealed" value={counts.revealed} />
        <Stat label="Negativity" value={pct(counts.negativityRate)} />
        <Stat label="Reveal rate" value={pct(counts.revealRate)} />
      </dl>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-sm text-[#7a746b]">{label}</dt>
      <dd className="serif text-3xl">{value}</dd>
    </div>
  );
}

function pct(value: number | null): string {
  return value == null ? "—" : `${Math.round(value * 100)}%`;
}

function barShare(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.max(0, Math.min(100, (part / whole) * 100));
}
