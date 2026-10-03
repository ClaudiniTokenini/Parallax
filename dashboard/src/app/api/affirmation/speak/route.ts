import { getSessionUser } from "@/lib/auth";
import { isKnownAffirmation } from "@/lib/affirmations";
import { preflight, withCors } from "@/lib/cors";
import { synthesizeAffirmation } from "@/lib/elevenlabs";
import { getOverviewPayload } from "@/lib/insight-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return preflight(request);
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return withCors(request, { ok: false, error: "Sign in first." }, 401);

  const affirmation = getOverviewPayload(user.id).insight.affirmation;
  if (!isKnownAffirmation(affirmation)) {
    return withCors(request, { ok: false, error: "No affirmation to read." }, 400);
  }

  try {
    const audio = await synthesizeAffirmation(affirmation);
    return new Response(audio, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, max-age=86400",
        "Content-Disposition": "inline; filename=\"affirmation.mp3\""
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read the affirmation.";
    return withCors(request, { ok: false, error: message }, 502);
  }
}
