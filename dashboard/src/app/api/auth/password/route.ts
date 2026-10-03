import { getSessionUser, setAccountCredentials } from "@/lib/auth";
import { preflight, withCors } from "@/lib/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return preflight(request);
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return withCors(request, { ok: false, error: "Sign in first." }, 401);
    const body = (await request.json()) as { username?: string; password?: string };
    const updated = await setAccountCredentials(
      user.id,
      String(body.username || user.username || ""),
      String(body.password || "")
    );
    return withCors(request, {
      ok: true,
      username: updated.username,
      hasPassword: updated.hasPassword
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save login";
    return withCors(request, { ok: false, error: message }, 400);
  }
}
