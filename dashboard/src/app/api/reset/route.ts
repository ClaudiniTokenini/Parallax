import { preflight, withCors } from "@/lib/cors";
import { wipeUserData } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return preflight(request);
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return withCors(request, { ok: false, error: "Sign in first." }, 401);
    wipeUserData(user.id);
    return withCors(request, { ok: true, reset: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reset failed";
    return withCors(request, { ok: false, error: message }, 500);
  }
}
