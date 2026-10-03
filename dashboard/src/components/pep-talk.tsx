"use client";

import { useState } from "react";

export function PepTalk({ lines }: { lines: string[] }) {
  const [line] = useState(() => lines[Math.floor(Math.random() * Math.max(1, lines.length))] || "Great work!");
  return <p className="serif mt-3 text-4xl leading-tight text-[#8d74d6] md:text-5xl">{line}</p>;
}
