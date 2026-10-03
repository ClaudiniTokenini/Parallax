import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";
const DEFAULT_MODEL_ID = "eleven_flash_v2_5";

export function elevenLabsConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim());
}

function config() {
  return {
    apiKey: process.env.ELEVENLABS_API_KEY?.trim() || "",
    voiceId: process.env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE_ID,
    modelId: process.env.ELEVENLABS_MODEL_ID?.trim() || DEFAULT_MODEL_ID
  };
}

function cacheFile(text: string, voiceId: string, modelId: string): string {
  const key = crypto.createHash("sha256").update(`${voiceId}:${modelId}:${text}`).digest("hex");
  return path.join(process.cwd(), "data", "tts", `${key}.mp3`);
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
    return "ElevenLabs free-tier quota is used up this month.";
  }
  if (status === 403) {
    return "That ElevenLabs voice is not available on the free tier. Set ELEVENLABS_VOICE_ID to a default voice.";
  }
  return detail || `ElevenLabs request failed (${status}).`;
}

async function requestSpeech(text: string, apiKey: string, voiceId: string, modelId: string): Promise<Buffer> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        Accept: "audio/mpeg",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: 0.58,
          similarity_boost: 0.72,
          speed: 0.94
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(parseElevenLabsError(response.status, await response.text()));
  }

  return Buffer.from(await response.arrayBuffer());
}

export async function synthesizeAffirmation(text: string): Promise<Buffer> {
  const { apiKey, voiceId, modelId } = config();
  if (!apiKey) {
    throw new Error("Add ELEVENLABS_API_KEY to dashboard/.env.local, then restart the dashboard.");
  }

  const file = cacheFile(text, voiceId, modelId);
  if (fs.existsSync(file)) return fs.readFileSync(file);

  let audio: Buffer;
  try {
    audio = await requestSpeech(text, apiKey, voiceId, modelId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (modelId === "eleven_multilingual_v2" || /API key|quota|free-tier/i.test(message)) {
      throw error;
    }
    audio = await requestSpeech(text, apiKey, voiceId, "eleven_multilingual_v2");
  }

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, audio);
  return audio;
}
