"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SettingsActions({
  polarConnected,
  polarConfigured
}: {
  polarConnected: boolean;
  polarConfigured: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function post(path: string, okText: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(path, { method: "POST" });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <a
          href="/api/polar/auth"
          className={`rounded-full px-5 py-2 text-sm font-medium ${
            polarConfigured ? "bg-[#cbb8f3]" : "bg-[#eee7dc] text-[#7a746b]"
          }`}
        >
          {polarConnected ? "Reconnect Polar" : "Connect Polar"}
        </a>
        <button
          type="button"
          disabled={busy || !polarConnected}
          onClick={() => post("/api/polar/sync", "Polar sync finished.")}
          className="rounded-full bg-[#efe8ff] px-5 py-2 text-sm font-medium disabled:opacity-50"
        >
          Sync now
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => post("/api/seed", "Demo digital and health data loaded.")}
          className="rounded-full bg-[#f6d35c] px-5 py-2 text-sm font-medium disabled:opacity-50"
        >
          Load demo data
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => post("/api/reset", "Local database wiped.")}
          className="rounded-full bg-[#1d1a16] px-5 py-2 text-sm font-medium text-[#fbf7f1] disabled:opacity-50"
        >
          Wipe local data
        </button>
      </div>
      {message ? <p className="text-sm text-[#7a746b]">{message}</p> : null}
    </div>
  );
}
