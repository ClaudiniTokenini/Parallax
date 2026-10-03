"use client";

import { useEffect, useState } from "react";

export function PepTalk({ lines }: { lines: string[] }) {
  const fallback = lines[0] || "Great work!";
  const [line, setLine] = useState(fallback);

  useEffect(() => {
    if (lines.length <= 1) return;
    setLine(lines[Math.floor(Math.random() * lines.length)] || fallback);
  }, []);

  return <p className="serif mt-3 text-4xl leading-tight text-[#8d74d6] md:text-5xl">{line}</p>;
}
