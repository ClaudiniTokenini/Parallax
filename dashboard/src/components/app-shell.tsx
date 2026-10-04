import type { ReactNode } from "react";
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { PairingTutorial } from "@/components/pairing-tutorial";
import { getRequestUser } from "@/lib/auth";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/physical", label: "Physical health" },
  { href: "/mental", label: "Mental wellbeing" },
  { href: "/settings", label: "Settings" }
];

export async function AppShell({
  current,
  children,
  compact = false
}: {
  current: string;
  children: ReactNode;
  compact?: boolean;
}) {
  const user = await getRequestUser();

  return (
    <div className={`${compact ? "flex h-dvh flex-col overflow-hidden" : "min-h-screen"} bg-[#fbf7f1] text-[#1d1a16]`}>
      <header className="mx-auto flex w-full max-w-6xl shrink-0 items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-3">
          <img src="/assets/logo_graphic.svg" alt="" className="h-8 w-10" />
          <img src="/assets/logo_text.svg" alt="PARALLAX" className="h-4 w-auto" />
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
        <div className="flex items-center gap-1">
          <PairingTutorial displayName={user.displayName} />
          <LogoutButton />
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
      <main className={`mx-auto w-full max-w-6xl px-6 ${compact ? "flex min-h-0 flex-1 flex-col pb-3" : "pb-8"}`}>{children}</main>
    </div>
  );
}
