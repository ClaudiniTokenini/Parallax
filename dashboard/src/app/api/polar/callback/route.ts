import { NextResponse } from "next/server";
import { exchangePolarCode, syncPolarData } from "@/lib/polar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const origin = "http://127.0.0.1:3000";

  if (!code) {
    return NextResponse.redirect(new URL("/settings?polar=denied", origin));
  }

  try {
    await exchangePolarCode(code);
    await syncPolarData().catch(() => undefined);
    return NextResponse.redirect(new URL("/settings?polar=connected", origin));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Polar connect failed";
    return NextResponse.redirect(
      new URL(`/settings?polar=error&detail=${encodeURIComponent(message.slice(0, 160))}`, origin)
    );
  }
}
