"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function AuthForm({
  mode
}: {
  mode: "login" | "register";
}) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(mode === "login" ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          displayName: displayName || username
        })
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not continue");
      router.push("/");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not continue");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-16">
      <img src="/assets/logo_graphic.svg" alt="" className="h-10 w-12" />
      <img src="/assets/logo_text.svg" alt="PARALLAX" className="mt-3 h-4 w-auto self-start" />
      <h1 className="serif mt-8 text-5xl">
        {mode === "login" ? "Sign in" : "Create an account"}
      </h1>

      <form onSubmit={(event) => void submit(event)} className="mt-8 flex flex-col gap-4">
        {mode === "register" ? (
          <label className="text-sm text-[#7a746b]">
            Display name
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[#efe8dc] bg-white px-4 py-3 text-[#1d1a16]"
            />
          </label>
        ) : null}
        <label className="text-sm text-[#7a746b]">
          Username
          <input
            value={username}
            autoComplete="username"
            onChange={(event) => setUsername(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-[#efe8dc] bg-white px-4 py-3 text-[#1d1a16]"
          />
        </label>
        <label className="text-sm text-[#7a746b]">
          Password
          <input
            type="password"
            value={password}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-[#efe8dc] bg-white px-4 py-3 text-[#1d1a16]"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="mt-2 rounded-full bg-[#cbb8f3] px-5 py-3 text-sm font-medium disabled:opacity-50"
        >
          {mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>
      {message ? <p className="mt-4 text-sm text-[#7a746b]">{message}</p> : null}
      <p className="mt-6 text-sm text-[#7a746b]">
        {mode === "login" ? (
          <>
            New here?{" "}
            <Link href="/register" className="text-[#8d74d6]">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have one?{" "}
            <Link href="/login" className="text-[#8d74d6]">
              Sign in
            </Link>
          </>
        )}
      </p>
    </main>
  );
}
