import { AppShell } from "@/components/app-shell";
import { SettingsActions } from "@/components/settings-actions";
import { getSettingsPayload } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams
}: {
  searchParams: Promise<{ polar?: string; detail?: string }>;
}) {
  const data = getSettingsPayload();
  const query = await searchParams;

  return (
    <AppShell current="/settings">
      <p className="text-xs tracking-[0.22em] text-[#7a746b]">SETTINGS</p>
      <h1 className="serif mt-3 text-5xl">Local connections</h1>
      <p className="mt-3 max-w-2xl text-[#7a746b]">
        Everything stays on this machine. The extension posts events to port 3000. Polar is
        optional; demo data is enough for a walkthrough.
      </p>

      {query.polar ? <PolarBanner status={query.polar} detail={query.detail} /> : null}

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Row label="Extension last event" value={when(data.lastExtensionEvent)} />
        <Row label="Polar" value={data.polarConnected ? `Connected · ${data.polarUserId}` : "Not connected"} />
        <Row label="Polar last sync" value={when(data.lastPolarSync)} />
        <Row label="Health source" value={data.dataSource || "empty"} />
        <Row label="Stored events" value={String(data.eventCount)} />
        <Row label="Sleep nights / workouts" value={`${data.sleepCount} / ${data.exerciseCount}`} />
        <Row
          label="Polar app keys"
          value={data.polarConfigured ? "Present in .env.local" : "Missing — demo data still works"}
        />
        <Row label="SQLite file" value="dashboard/data/parallax.db" />
      </div>

      <div className="mt-8">
        <SettingsActions polarConnected={data.polarConnected} polarConfigured={data.polarConfigured} />
      </div>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-white/70 p-5">
      <p className="text-[11px] tracking-[0.16em] text-[#7a746b]">{label}</p>
      <p className="mt-2 text-lg">{value}</p>
    </div>
  );
}

function when(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "—";
}

function PolarBanner({ status, detail }: { status: string; detail?: string }) {
  const copy: Record<string, string> = {
    connected: "Polar connected. A first sync was attempted.",
    missing: "Add POLAR_CLIENT_ID and POLAR_CLIENT_SECRET to dashboard/.env.local.",
    denied: "Polar authorization was cancelled.",
    error: detail || "Polar connect failed."
  };
  return (
    <p className="mt-6 rounded-2xl bg-[#efe8ff] px-4 py-3 text-sm">{copy[status] || status}</p>
  );
}
