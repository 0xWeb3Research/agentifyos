import Link from "next/link";
import { Container } from "./ui";
import { Logo } from "./logo";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-border">
      <Container className="flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="text-sm font-medium tracking-[-0.02em]">AgentifyOS</span>
          <span className="label ml-2">agentifyos.xyz</span>
        </div>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-fg-secondary">
          <Link href="/tools" className="hover:text-fg">Tools</Link>
          <Link href="/explain" className="hover:text-fg">How it works</Link>
          <Link href="/docs" className="hover:text-fg">Docs</Link>
          <Link href="/agent" className="hover:text-fg">Agent demo</Link>
          <Link href="/developers" className="hover:text-fg">Developers</Link>
          <Link href="/publish" className="hover:text-fg">Publish</Link>
          <Link href="/dashboard" className="hover:text-fg">Dashboard</Link>
          <Link href="/roadmap" className="hover:text-fg">Roadmap</Link>
          <a href="/whitepaper.pdf" className="hover:text-fg">Whitepaper</a>
          <a href="/llms.txt" className="hover:text-fg">llms.txt</a>
        </nav>
        <p className="label">first tool market on casper x402</p>
      </Container>
    </footer>
  );
}
