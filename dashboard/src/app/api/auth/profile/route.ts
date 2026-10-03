import { getRequestUser, renameUser } from "@/lib/auth";
import { preflight, withCors } from "@/lib/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return preflight(request);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { displayName?: string };
    const user = await getRequestUser();
    const updated = renameUser(user.id, String(body.displayName || ""));
    return withCors(request, { ok: true, displayName: updated.displayName });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save profile";
    return withCors(request, { ok: false, error: message }, 400);
  }
}
