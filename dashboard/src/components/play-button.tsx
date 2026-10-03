"use client";

import { useState } from "react";

export function PlayButton() {
  const [playing, setPlaying] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setPlaying((value) => !value)}
      className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#cbb8f3] px-5 py-2 text-sm font-medium text-[#1d1a16]"
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/70 text-[10px]">
        {playing ? "II" : "▶"}
      </span>
      {playing ? "Voice coming later" : "Play"}
    </button>
  );
}
