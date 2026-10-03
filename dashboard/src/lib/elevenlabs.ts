import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_VOICE_ID = "pjcYQlDFKMbcOUp6F5GD";
const DEFAULT_MODEL_ID = "eleven_multilingual_v2";

function envFileCandidates(): string[] {
  return [
    path.join(process.cwd(), ".env.local"),
    path.join(process.cwd(), "dashboard", ".env.local")
  ];
}

function stripValue(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, "");
}

function readLocalEnv(): Record<string, string> {
  const values: Record<string, string> = {};
  for (const file of envFileCandidates()) {
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
    for (const line of text.split(/\r?\n/)) {
      if (!line || line.startsWith("#")) continue;
      const index = line.indexOf("=");
      if (index === -1) continue;
      values[line.slice(0, index).trim()] = stripValue(line.slice(index + 1));
    }
    break;
  }
  return values;
}

export function elevenLabsConfigured(): boolean {
  return Boolean(config().apiKey);
}

export function config(): { apiKey: string; voiceId: string; modelId: string } {
  const file = readLocalEnv();
  return {
    apiKey: stripValue(file.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY || ""),
    voiceId: stripValue(file.ELEVENLABS_VOICE_ID || process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID),
    modelId: stripValue(file.ELEVENLABS_MODEL_ID || process.env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL_ID)
  };
}

function parseElevenLabsError(status: number, body: string): string {
  let detail = body.slice(0, 280);
  try {
    const parsed = JSON.parse(body) as { detail?: unknown };
    if (typeof parsed.detail === "string") detail = parsed.detail;
    else if (parsed.detail && typeof parsed.detail === "object") {
      const nested = parsed.detail as { message?: string; status?: string };
      detail = nested.message || nested.status || detail;
    }
  } catch {
    // keep raw snippet
  }
  if (/unusual activity/i.test(detail)) {
    return "ElevenLabs paused free-tier speech on this account.";
  }
  if (status === 401 || /invalid_api_key/i.test(detail)) {
    return detail || "ElevenLabs API key is invalid.";
  }
  if (status === 402 || /quota|credit|limit/i.test(detail)) {
    return "ElevenLabs quota is used up this month.";
  }
  if (status === 403) {
    return "That ElevenLabs voice is not available on this plan. Add it in My Voices, then set ELEVENLABS_VOICE_ID.";
  }
  return detail || `ElevenLabs request failed (${status}).`;
}

async function requestSpeech(text: string, apiKey: string, voiceId: string, modelId: string): Promise<Buffer> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
    {
      method: "POST",
      cache: "no-store",
      headers: {
        "xi-api-key": apiKey,
        Accept: "audio/mpeg",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text,
        model_id: modelId
      })
    }
  );

  if (!response.ok) {
    throw new Error(parseElevenLabsError(response.status, await response.text()));
  }

  return Buffer.from(await response.arrayBuffer());
}

export async function synthesizeAffirmation(text: string): Promise<{ audio: Buffer; voiceId: string; modelId: string }> {
  const { apiKey, voiceId, modelId } = config();
  if (!apiKey) {
    throw new Error("Add ELEVENLABS_API_KEY to dashboard/.env.local, then restart the dashboard.");
  }
  if (!voiceId) {
    throw new Error("Set ELEVENLABS_VOICE_ID in dashboard/.env.local.");
  }

  const audio = await requestSpeech(text, apiKey, voiceId, modelId);
  return { audio, voiceId, modelId };
}
