"use client";

import { useEffect, useRef, useState } from "react";

let skipElevenLabs = false;

function pickEnglishVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  return (
    voices.find((voice) => /en-GB/i.test(voice.lang) && /female|samantha|libby|google/i.test(voice.name)) ||
    voices.find((voice) => /^en/i.test(voice.lang)) ||
    voices[0] ||
    null
  );
}

export function PlayButton({ text }: { text: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const loadedForRef = useRef<string | null>(null);
  const localRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  function stopLocal() {
    localRef.current = false;
    window.speechSynthesis?.cancel();
  }

  function stopAll() {
    audioRef.current?.pause();
    stopLocal();
    setPlaying(false);
  }

  useEffect(() => {
    window.speechSynthesis?.getVoices?.();
    return () => {
      audioRef.current?.pause();
      window.speechSynthesis?.cancel();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  useEffect(() => {
    stopAll();
    loadedForRef.current = null;
  }, [text]);

  async function ensureAudio(): Promise<HTMLAudioElement> {
    if (audioRef.current && loadedForRef.current === text) return audioRef.current;

    const response = await fetch("/api/affirmation/speak", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.includes("audio")) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      const error = payload?.error || "Could not load the voice.";
      if (/paused free-tier|unusual activity/i.test(error)) skipElevenLabs = true;
      throw new Error(error);
    }

    const blob = await response.blob();
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(blob);
    objectUrlRef.current = url;

    const audio = audioRef.current || new Audio();
    audioRef.current = audio;
    audio.src = url;
    loadedForRef.current = text;
    audio.onended = () => setPlaying(false);
    audio.onpause = () => {
      if (audio.ended || audio.currentTime === 0) return;
      setPlaying(false);
    };
    return audio;
  }

  function playLocally() {
    if (!window.speechSynthesis) {
      throw new Error("This browser cannot read the affirmation.");
    }
    stopLocal();
    const speak = () => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.92;
      utterance.pitch = 1;
      const voice = pickEnglishVoice();
      if (voice) utterance.voice = voice;
      utterance.onend = () => {
        localRef.current = false;
        setPlaying(false);
      };
      utterance.onerror = () => {
        localRef.current = false;
        setPlaying(false);
      };
      localRef.current = true;
      window.speechSynthesis.resume();
      window.speechSynthesis.speak(utterance);
      setPlaying(true);
    };
    speak();
  }

  async function toggle() {
    if (loading) return;
    setMessage("");

    if (playing) {
      stopAll();
      return;
    }

    if (skipElevenLabs) {
      playLocally();
      return;
    }

    setLoading(true);
    try {
      const audio = await ensureAudio();
      stopLocal();
      await audio.play();
      setPlaying(true);
    } catch {
      skipElevenLabs = true;
      try {
        playLocally();
      } catch (error) {
        setPlaying(false);
        setMessage(error instanceof Error ? error.message : "Could not play the affirmation.");
      }
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
        className="inline-flex items-center gap-2 rounded-full bg-[#cbb8f3] px-3 py-1 text-sm font-medium text-[#1d1a16] disabled:opacity-60"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/70 text-[10px]">
          {playing ? "II" : "▶"}
        </span>
        {loading ? "Loading" : playing ? "Pause" : "Play"}
      </button>
      {message ? <p className="mt-1 max-w-sm text-xs text-[#7a746b]">{message}</p> : null}
    </div>
  );
}
