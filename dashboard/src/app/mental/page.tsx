import { AppShell } from "@/components/app-shell";
import { AutoRefresh } from "@/components/auto-refresh";
import { MentalRecap } from "@/components/mental-recap";
import { getRequestUser } from "@/lib/auth";
import { getMentalPayload } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function MentalPage() {
  const user = await getRequestUser();
  const data = getMentalPayload(user.id);

  return (
    <AppShell current="/mental">
      <AutoRefresh />
      <p className="text-xs tracking-[0.22em] text-[#7a746b]">MENTAL WELLBEING</p>
      <h1 className="serif mt-3 text-5xl">What the feed asked of you</h1>
      <p className="mt-3 max-w-2xl text-[#7a746b]">
        Daily totals from the extension, for this local profile only. No post text is stored. Rates
        are compared to your last 14 days, not to other people.
      </p>
      {data.lastExtensionEvent ? (
        <p className="mt-2 text-sm text-[#9a9388]">
          Last extension event {new Date(data.lastExtensionEvent).toLocaleString()}
        </p>
      ) : null}

      <MentalRecap summary={data.summary} />
    </AppShell>
  );
}
