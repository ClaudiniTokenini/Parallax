"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function SettingsProfile({
  displayName,
  username,
  hasPassword,
  pairingToken
}: {
  displayName: string;
  username: string | null;
  hasPassword: boolean;
  pairingToken: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(displayName);
  const [token, setToken] = useState(pairingToken);
  const [loginName, setLoginName] = useState(username || "");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const tokenRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(displayName);
    setToken(pairingToken);
    setLoginName(username || "");
  }, [displayName, pairingToken, username]);

  async function saveName() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name })
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string; displayName?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not save name");
      setName(payload.displayName || name);
      setMessage("Profile name saved.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save name");
    } finally {
      setBusy(false);
    }
  }

  async function saveLogin() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginName, password })
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not save login");
      setPassword("");
      setMessage("Username and password saved. Use them to sign in on this machine.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save login");
    } finally {
      setBusy(false);
    }
  }

  async function rotateToken() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/token", { method: "POST" });
      const payload = (await response.json()) as { ok?: boolean; error?: string; pairingToken?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not rotate code");
      setToken(payload.pairingToken || token);
      setMessage("New pairing code. Paste it in the extension.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not rotate code");
    } finally {
      setBusy(false);
    }
  }

  function copyToken() {
    const value = String(token || "");
    const field = tokenRef.current;
    if (!value) {
      setMessage("Nothing to copy yet.");
      return;
    }

    field?.focus();
    field?.select();
    field?.setSelectionRange(0, value.length);

    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }

    if (copied) {
      setMessage("Pairing code copied.");
      return;
    }

    const writeText = navigator.clipboard?.writeText?.bind(navigator.clipboard);
    if (writeText) {
      void writeText(value).then(
        () => setMessage("Pairing code copied."),
        () => {
          field?.select();
          setMessage("Code selected — press Ctrl+C.");
        }
      );
      return;
    }

    field?.select();
    setMessage("Code selected — press Ctrl+C.");
  }

  return (
    <div className="rounded-[28px] bg-white/70 p-6">
      <p className="text-[11px] tracking-[0.16em] text-[#7a746b]">YOUR ACCOUNT</p>
      <p className="mt-2 max-w-2xl text-sm text-[#7a746b]">
        Sign in with username and password. The extension uses the pairing code, not your password.
      </p>

      {!hasPassword ? (
        <p className="mt-4 rounded-2xl bg-[#efe8ff] px-4 py-3 text-sm text-[#1d1a16]">
          Set a username and password now, or this profile stays open on this browser only.
        </p>
      ) : null}

      <label className="mt-5 block text-sm text-[#7a746b]">
        Display name
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-2 w-full rounded-2xl border border-[#efe8dc] bg-white px-4 py-3 text-[#1d1a16]"
        />
      </label>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="block text-sm text-[#7a746b]">
          Username
          <input
            value={loginName}
            autoComplete="username"
            onChange={(event) => setLoginName(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-[#efe8dc] bg-white px-4 py-3 text-[#1d1a16]"
          />
        </label>
        <label className="block text-sm text-[#7a746b]">
          {hasPassword ? "New password" : "Password"}
          <input
            type="password"
            value={password}
            autoComplete="new-password"
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-[#efe8dc] bg-white px-4 py-3 text-[#1d1a16]"
          />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void saveName()}
          className="rounded-full bg-[#cbb8f3] px-5 py-2 text-sm font-medium disabled:opacity-50"
        >
          Save name
        </button>
        <button
          type="button"
          disabled={busy || !loginName.trim() || !password}
          onClick={() => void saveLogin()}
          className="rounded-full bg-[#1d1a16] px-5 py-2 text-sm font-medium text-[#fbf7f1] disabled:opacity-50"
        >
          Save login
        </button>
      </div>

      <div className="mt-8">
        <label className="block text-sm text-[#7a746b]">
          Pairing code
          <input
            ref={tokenRef}
            readOnly
            value={token}
            onFocus={(event) => event.currentTarget.select()}
            className="mt-2 w-full rounded-2xl border-0 bg-[#fbf7f1] px-4 py-3 font-mono text-sm text-[#1d1a16] outline-none"
          />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onPointerDown={(event) => {
            event.preventDefault();
            copyToken();
          }}
          className="rounded-full bg-[#efe8ff] px-5 py-2 text-sm font-medium disabled:opacity-50"
        >
          Copy code
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void rotateToken()}
          className="rounded-full bg-[#efe8ff] px-5 py-2 text-sm font-medium disabled:opacity-50"
        >
          New pairing code
        </button>
      </div>
      {message ? <p className="mt-3 text-sm text-[#7a746b]">{message}</p> : null}
    </div>
  );
}
