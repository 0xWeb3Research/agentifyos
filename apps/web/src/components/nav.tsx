"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

const LINKS = [
  { href: "/tools", label: "Tools" },
  { href: "/explain", label: "How it works" },
  { href: "/agent", label: "Agent" },
  { href: "/developers", label: "Developers" },
  { href: "/publish", label: "Publish" },
  { href: "/dashboard", label: "Dashboard" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center gap-6 px-6">
        <Link href="/" className="press flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-[7px] bg-fg text-surface">
            <span className="font-mono text-[13px] leading-none">A</span>
          </span>
          <span className="text-[15px] font-medium tracking-[-0.02em]">
            AgentifyOS
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => {
            const active = pathname === l.href || pathname.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={clsx(
                  "press rounded-[var(--radius-sm)] px-3 py-1.5 text-sm transition-colors",
                  active ? "bg-tint text-fg" : "text-fg-secondary hover:text-fg",
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <span className="label hidden sm:inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-border bg-surface px-2.5 py-1">
            <span className="inline-block h-1.5 w-1.5 animate-pulse-dot rounded-full bg-success" />
            casper testnet
          </span>
          <Link
            href="/tools"
            className="press hidden rounded-[var(--radius-sm)] bg-fg px-3.5 py-1.5 text-sm font-medium text-surface hover:bg-fg/90 sm:inline-flex"
          >
            Browse tools
          </Link>
        </div>
      </div>
    </header>
  );
}
