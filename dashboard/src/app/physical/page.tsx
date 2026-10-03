import { AppShell } from "@/components/app-shell";
import { AutoRefresh } from "@/components/auto-refresh";
import { PhysicalRecap } from "@/components/physical-recap";
import { getPhysicalPayload } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default function PhysicalPage() {
  const data = getPhysicalPayload();

  return (
    <AppShell current="/physical">
      <AutoRefresh />
      <p className="text-xs tracking-[0.22em] text-[#7a746b]">PHYSICAL HEALTH</p>
      <h1 className="serif mt-3 text-5xl">What your body already did</h1>
      <p className="mt-3 max-w-2xl text-[#7a746b]">
        Totals and a pep talk from your watch export. The day-by-day diary stays in the training
        app; this page is the recap.
      </p>
      {data.lastPolarSync ? (
        <p className="mt-2 text-sm text-[#9a9388]">
          Updated {new Date(data.lastPolarSync).toLocaleString()}
        </p>
      ) : null}

      <PhysicalRecap summary={data.summary} />
    </AppShell>
  );
}
