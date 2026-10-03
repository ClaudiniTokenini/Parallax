"use client";

import { useEffect, useRef, useState } from "react";

export function PlayButton({ text }: { text: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [voiceId, setVoiceId] = useState("");

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  useEffect(() => {
    audioRef.current?.pause();
    setPlaying(false);
  }, [text]);

  async function loadAudio(): Promise<HTMLAudioElement> {
    const response = await fetch("/api/affirmation/speak", {
      method: "POST",
      cache: "no-store"
    });
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.includes("audio")) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error || "Could not load the ElevenLabs voice.");
    }

    setVoiceId(response.headers.get("x-parallax-voice") || "");
    const blob = await response.blob();
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(blob);
    objectUrlRef.current = url;

    const audio = audioRef.current || new Audio();
    audioRef.current = audio;
    audio.src = url;
    audio.onended = () => setPlaying(false);
    audio.onpause = () => {
      if (audio.ended || audio.currentTime === 0) return;
      setPlaying(false);
    };
    return audio;
  }

  async function toggle() {
    if (loading) return;
    setMessage("");

    if (playing && audioRef.current) {
      audioRef.current.pause();
      setPlaying(false);
      return;
    }

    setLoading(true);
    try {
      const audio = await loadAudio();
      await audio.play();
      setPlaying(true);
    } catch (error) {
      setPlaying(false);
      setMessage(error instanceof Error ? error.message : "Could not play the affirmation.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={loading}
        aria-pressed={playing}
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#cbb8f3] px-5 py-2 text-sm font-medium text-[#1d1a16] disabled:opacity-60"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/70 text-[10px]">
          {playing ? "II" : "▶"}
        </span>
        {loading ? "Loading" : playing ? "Pause" : "Play"}
      </button>
      {message ? <p className="mt-3 max-w-sm text-sm text-[#7a746b]">{message}</p> : null}
    </div>
  );
}
