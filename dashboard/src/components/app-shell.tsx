import type { ReactNode } from "react";
import Link from "next/link";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/physical", label: "Physical health" },
  { href: "/mental", label: "Mental wellbeing" },
  { href: "/settings", label: "Settings" }
];

export function AppShell({
  current,
  children
}: {
  current: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#fbf7f1] text-[#1d1a16]">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-[0.18em]">
          <span className="relative h-3.5 w-3.5">
            <span className="absolute inset-0 rounded-full bg-[#cbb8f3]" />
            <span className="absolute left-1.5 top-0 h-3.5 w-3.5 rounded-full bg-[#f6d35c]" />
          </span>
          PARALLAX
        </Link>
        <nav className="hidden items-center gap-2 md:flex">
          {LINKS.map((link) => {
            const active = current === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-4 py-2 text-sm ${
                  active ? "bg-[#efe8ff] text-[#1d1a16]" : "text-[#7a746b] hover:bg-[#f3eee6]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#efe8ff] text-sm">
          You
        </div>
      </header>
      <nav className="mx-auto flex w-full max-w-6xl gap-2 overflow-auto px-6 pb-2 md:hidden">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${
              current === link.href ? "bg-[#efe8ff]" : "bg-[#f3eee6] text-[#7a746b]"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <main className="mx-auto w-full max-w-6xl px-6 pb-16">{children}</main>
    </div>
  );
}
