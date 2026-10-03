import { preflight, withCors } from "@/lib/cors";
import { syncPolarData } from "@/lib/polar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return preflight(request);
}

export async function POST(request: Request) {
  try {
    const result = await syncPolarData();
    return withCors(request, { ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Polar sync failed";
    return withCors(request, { ok: false, error: message }, 400);
  }
}
