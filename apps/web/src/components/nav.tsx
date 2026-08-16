"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { Logo } from "./logo";
import { ChainSwitcher } from "./chain-switcher";
import type { ChainId } from "@/lib/chain";

const LINKS = [
  { href: "/tools", label: "Tools" },
  { href: "/explain", label: "How it works" },
  { href: "/docs", label: "Docs" },
  { href: "/agent", label: "Agent" },
  { href: "/developers", label: "Developers" },
  { href: "/publish", label: "Publish" },
  { href: "/dashboard", label: "Dashboard" },
];

export function Nav({ chainReady }: { chainReady: Record<ChainId, boolean> }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the menu on navigation, and don't leave the page scroll-locked.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center gap-4 px-4 sm:gap-6 sm:px-6">
        <Link href="/" className="press flex shrink-0 items-center gap-2">
          <Logo />
          <span className="text-[15px] font-medium tracking-[-0.02em]">AgentifyOS</span>
        </Link>

        <nav className="hidden min-w-0 items-center gap-0.5 md:flex lg:gap-1">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={clsx(
                "press rounded-[var(--radius-sm)] px-3 py-1.5 text-sm transition-colors",
                isActive(l.href) ? "bg-tint text-fg" : "text-fg-secondary hover:text-fg",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ChainSwitcher ready={chainReady} className="hidden lg:block" />
          <Link
            href="/tools"
            className="press hidden rounded-[var(--radius-sm)] bg-fg px-3.5 py-1.5 text-sm font-medium text-surface hover:bg-fg/90 sm:inline-flex"
          >
            Browse tools
          </Link>

          {/* Below md the links collapse, so give small screens a way through. */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="press grid h-8 w-8 place-items-center rounded-[var(--radius-sm)] border border-border bg-surface md:hidden"
          >
            <span className="relative block h-[10px] w-[14px]">
              <span
                className={clsx(
                  "absolute left-0 block h-[1.5px] w-full rounded bg-fg transition-transform duration-200 ease-[var(--ease-out)]",
                  open ? "top-[4px] rotate-45" : "top-0",
                )}
              />
              <span
                className={clsx(
                  "absolute left-0 block h-[1.5px] w-full rounded bg-fg transition-transform duration-200 ease-[var(--ease-out)]",
                  open ? "top-[4px] -rotate-45" : "top-[8px]",
                )}
              />
            </span>
          </button>
        </div>
      </div>

      {/* mobile sheet */}
      {open && (
        <div className="animate-fade-up border-t border-border bg-bg md:hidden">
          <nav className="mx-auto flex w-full max-w-[1200px] flex-col px-4 py-2">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={clsx(
                  "press rounded-[var(--radius-sm)] px-3 py-3 text-[15px] transition-colors",
                  isActive(l.href) ? "bg-tint text-fg" : "text-fg-secondary hover:text-fg",
                )}
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-2 flex items-center justify-between border-t border-border px-3 pb-2 pt-3">
              <ChainSwitcher ready={chainReady} />
              <Link
                href="/tools"
                className="press rounded-[var(--radius-sm)] bg-fg px-3.5 py-1.5 text-sm font-medium text-surface"
              >
                Browse tools
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
