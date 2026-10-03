import { AppShell } from "@/components/app-shell";
import { AutoRefresh } from "@/components/auto-refresh";
import { getPhysicalPayload } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default function PhysicalPage() {
  const data = getPhysicalPayload();

  return (
    <AppShell current="/physical">
      <AutoRefresh />
      <p className="text-xs tracking-[0.22em] text-[#7a746b]">PHYSICAL HEALTH</p>
      <h1 className="serif mt-3 text-5xl">Body side of the picture</h1>
      <p className="mt-3 max-w-2xl text-[#7a746b]">
        Sleep, workouts, and Nightly Recharge from Polar or demo fixtures. Compared to your own
        last 14 days, not a generic healthy target.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Card
          label="Hours since workout"
          value={data.hoursSinceWorkout == null ? "—" : `${Math.round(data.hoursSinceWorkout)}h`}
          detail={data.lastWorkout?.sport || "No exercise stored yet"}
        />
        <Card
          label="Recent sleep"
          value={data.recentSleepHours == null ? "—" : `${data.recentSleepHours.toFixed(1)}h`}
          detail={
            data.baselineSleepHours
              ? `14-day mean ${data.baselineSleepHours.toFixed(1)}h`
              : "Need more nights for a baseline"
          }
        />
        <Card
          label="Data source"
          value={data.dataSource === "live" ? "Polar" : data.dataSource === "fixture" ? "Demo" : "Empty"}
          detail={data.lastPolarSync ? `Last Polar sync ${new Date(data.lastPolarSync).toLocaleString()}` : "Polar optional"}
        />
      </div>

      <section className="mt-10 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="text-sm tracking-[0.16em] text-[#7a746b]">SLEEP NIGHTS</h2>
          <ul className="mt-4 divide-y divide-[#efe8dc]">
            {data.sleepNights.slice(0, 10).map((night) => (
              <li key={night.date} className="flex items-center justify-between py-3">
                <span>{night.date}</span>
                <span className="text-[#7a746b]">
                  {(night.durationSeconds / 3600).toFixed(1)}h · {night.source}
                </span>
              </li>
            ))}
            {!data.sleepNights.length ? <Empty /> : null}
          </ul>
        </div>
        <div>
          <h2 className="text-sm tracking-[0.16em] text-[#7a746b]">WORKOUTS</h2>
          <ul className="mt-4 divide-y divide-[#efe8dc]">
            {data.exercises.slice(0, 10).map((exercise) => (
              <li key={exercise.polarId} className="flex items-center justify-between py-3">
                <span>{exercise.sport || "Session"}</span>
                <span className="text-[#7a746b]">
                  {new Date(exercise.startTime).toLocaleString()} ·{" "}
                  {Math.round(exercise.durationSeconds / 60)} min
                </span>
              </li>
            ))}
            {!data.exercises.length ? <Empty /> : null}
          </ul>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-sm tracking-[0.16em] text-[#7a746b]">RECHARGE</h2>
        <ul className="mt-4 divide-y divide-[#efe8dc]">
          {data.rechargeNights.slice(0, 8).map((night) => (
            <li key={night.date} className="flex items-center justify-between py-3">
              <span>{night.date}</span>
              <span className="text-[#7a746b]">
                {night.status || "status unknown"}
                {night.ansCharge != null ? ` · ANS ${Math.round(night.ansCharge)}` : ""}
              </span>
            </li>
          ))}
          {!data.rechargeNights.length ? <Empty /> : null}
        </ul>
      </section>
    </AppShell>
  );
}

function Card({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-3xl bg-white/70 p-5">
      <p className="text-[11px] tracking-[0.16em] text-[#7a746b]">{label}</p>
      <p className="serif mt-2 text-3xl">{value}</p>
      <p className="mt-2 text-sm text-[#7a746b]">{detail}</p>
    </div>
  );
}

function Empty() {
  return <li className="py-3 text-[#7a746b]">Nothing stored yet. Load demo data or connect Polar.</li>;
}
