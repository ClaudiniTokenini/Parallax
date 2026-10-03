import { preflight, withCors } from "@/lib/cors";
import { getRequestUser } from "@/lib/auth";
import { getMentalPayload } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return preflight(request);
}

export async function GET(request: Request) {
  const user = await getRequestUser();
  return withCors(request, { ok: true, ...getMentalPayload(user.id) });
}
