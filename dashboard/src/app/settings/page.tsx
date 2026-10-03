import { AppShell } from "@/components/app-shell";
import { SettingsActions } from "@/components/settings-actions";
import { getSettingsPayload } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const data = getSettingsPayload();

  return (
    <AppShell current="/settings">
      <p className="text-xs tracking-[0.22em] text-[#7a746b]">SETTINGS</p>
      <h1 className="serif mt-3 text-5xl">Local connections</h1>
      <p className="mt-3 max-w-2xl text-[#7a746b]">
        Everything stays on this machine. The extension posts events to port 3000. Health stats
        come from a ZIP export of your watch or training app.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Row label="Extension last event" value={when(data.lastExtensionEvent)} />
        <Row label="Health last import" value={when(data.lastPolarSync)} />
        <Row label="Stored events" value={String(data.eventCount)} />
        <Row label="Sleep nights / workouts" value={`${data.sleepCount} / ${data.exerciseCount}`} />
        <Row label="Step days" value={String(data.activityCount)} />
        <Row label="SQLite file" value="dashboard/data/parallax.db" />
      </div>

      <div className="mt-8">
        <SettingsActions />
        <p className="mt-4 max-w-2xl text-sm text-[#7a746b]">
          Upload fills Physical health with workouts, daily steps, and sleep. Wipe clears the local
          database without deleting the file on disk.
        </p>
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
