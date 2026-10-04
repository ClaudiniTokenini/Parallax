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

async function affirmationFromRequest(request: Request, userId: string): Promise<string> {
  if (request.method === "POST") {
    try {
      const body = (await request.json()) as { text?: string };
      const text = String(body.text || "").trim();
      if (text && isKnownAffirmation(text)) return text;
    } catch {
      // fall through to current insight
    }
  }
  return getOverviewPayload(userId).insight.affirmation;
}

async function speak(request: Request) {
  const user = await getSessionUser();
  if (!user) return withCors(request, { ok: false, error: "Sign in first." }, 401);

  const affirmation = await affirmationFromRequest(request, user.id);
  if (!isKnownAffirmation(affirmation)) {
    return withCors(request, { ok: false, error: "No affirmation to read." }, 400);
  }

  try {
    const audio = await synthesizeAffirmation(affirmation);
    return new Response(new Uint8Array(audio), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Content-Disposition": 'inline; filename="affirmation.mp3"'
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read the affirmation.";
    return withCors(request, { ok: false, error: message }, 502);
  }
}

export async function GET(request: Request) {
  return speak(request);
}

export async function POST(request: Request) {
  return speak(request);
}
