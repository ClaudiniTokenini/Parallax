import { preflight, withCors } from "@/lib/cors";
import { getSessionUser } from "@/lib/auth";
import { getMentalPayload } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return preflight(request);
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return withCors(request, { ok: false, error: "Sign in first." }, 401);
  return withCors(request, { ok: true, ...getMentalPayload(user.id) });
}
