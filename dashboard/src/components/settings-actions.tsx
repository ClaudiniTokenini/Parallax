"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export function SettingsActions() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function post(path: string, okText: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(path, { method: "POST" });
      const payload = await readJson(response);
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || `Request failed (${response.status})`);
      }
      setMessage(okText);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  async function uploadZip(file: File) {
    setBusy(true);
    setMessage("");
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/polar/import", { method: "POST", body });
      const payload = await readJson(response);
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || `Upload failed (${response.status})`);
      }
      setMessage(
        `Imported ${payload.exercises ?? 0} workouts, ${payload.activity ?? 0} step days, ${payload.sleep ?? 0} nights.`
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="rounded-full bg-[#cbb8f3] px-5 py-2 text-sm font-medium disabled:opacity-50"
        >
          Upload health ZIP
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadZip(file);
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => post("/api/reset", "Local data for this profile wiped.")}
          className="rounded-full bg-[#1d1a16] px-5 py-2 text-sm font-medium text-[#fbf7f1] disabled:opacity-50"
        >
          Wipe local data
        </button>
      </div>
      {message ? <p className="text-sm text-[#7a746b]">{message}</p> : null}
    </div>
  );
}

async function readJson(response: Response): Promise<{
  ok?: boolean;
  error?: string;
  exercises?: number;
  sleep?: number;
  activity?: number;
}> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as {
      ok?: boolean;
      error?: string;
      exercises?: number;
      sleep?: number;
      activity?: number;
    };
  } catch {
    return { error: text.slice(0, 180) };
  }
}
