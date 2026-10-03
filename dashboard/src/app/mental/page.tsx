import { AppShell } from "@/components/app-shell";
import { AutoRefresh } from "@/components/auto-refresh";
import { getMentalPayload } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default function MentalPage() {
  const data = getMentalPayload();

  return (
    <AppShell current="/mental">
      <AutoRefresh />
      <p className="text-xs tracking-[0.22em] text-[#7a746b]">MENTAL WELLBEING</p>
      <h1 className="serif mt-3 text-5xl">What the feed asked of you</h1>
      <p className="mt-3 max-w-2xl text-[#7a746b]">
        Counts from the local extension only. No post text is stored. Rates are compared to your
        last 14 days, not to other people.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <WindowCard title="Last 3 days" counts={data.last3Days} />
        <WindowCard title="Last 14 days / baseline" counts={data.last14Days} />
      </div>

      <p className="mt-8 text-sm text-[#7a746b]">
        Last extension event:{" "}
        {data.lastExtensionEvent ? new Date(data.lastExtensionEvent).toLocaleString() : "none yet"}
      </p>
    </AppShell>
  );
}

function WindowCard({
  title,
  counts
}: {
  title: string;
  counts: {
    classified: number;
    negative: number;
    hidden: number;
    revealed: number;
    negativityRate: number | null;
    revealRate: number | null;
  };
}) {
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
