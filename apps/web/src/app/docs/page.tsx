import type { Metadata } from "next";
import Link from "next/link";
import { Container, Eyebrow, Arrow, Chip } from "@/components/ui";
import { listDocs } from "@/lib/docs";
import { abs } from "@/lib/site";

export const metadata: Metadata = {
  title: "Docs",
  description:
    "Everything about AgentifyOS: how x402 payments work on Casper, the testnet runbook, the CLI and MCP server, and the on-chain addresses.",
  alternates: { canonical: "/docs" },
  openGraph: {
    title: "Docs",
    description:
      "Six documents, in reading order: what an agent is, how the x402 handshake works, the testnet runbook, the CLI and MCP server, the addresses, and the proof.",
    url: abs("/docs"),
    type: "website",
  },
};

export default async function DocsIndexPage() {
  const docs = await listDocs();

  return (
    <main>
      <Container className="pb-6 pt-16">
        <Eyebrow>documentation</Eyebrow>
        <h1 className="mt-4 max-w-[18ch] text-[36px] font-medium leading-[1.05] tracking-[-0.03em] sm:text-[44px]">
          Read the whole thing.
        </h1>
        <p className="mt-5 max-w-[62ch] text-[15px] leading-relaxed text-fg-secondary">
          Six documents, written to be read in order. The first assumes you know
          nothing about agents or blockchains. The last is a list of transaction
          hashes you can check yourself.
        </p>
      </Container>

      <Container className="pb-16">
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {docs.map((d, i) => (
            <Link
              key={d.slug}
              href={`/docs/${d.slug}`}
              className="press group flex min-w-0 flex-col rounded-[var(--radius-card)] border border-border bg-surface p-5 transition-colors hover:border-border-hover"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="stat text-muted">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="label text-muted">{d.minutes} min</span>
              </div>
              <h2 className="mt-3 flex items-center gap-1.5 text-[17px] font-medium tracking-[-0.02em]">
                {d.title}
                <Arrow className="text-muted group-hover:translate-x-0.5 group-hover:text-fg" />
              </h2>
              <p className="mt-2 text-[13.5px] leading-relaxed text-fg-secondary">
                {d.summary}
              </p>
            </Link>
          ))}
        </div>

        {docs.length === 0 && (
          <p className="mt-4 text-[14px] text-fg-secondary">
            The docs directory wasn&apos;t found in this deployment. Read them in the
            repository under <span className="font-mono text-[13px]">docs/</span>.
          </p>
        )}

        <div className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[var(--radius-card)] border border-border bg-surface px-5 py-4 text-[13.5px] leading-relaxed text-fg-secondary">
          <Chip tone="accent">for machines</Chip>
          Agents and crawlers should read{" "}
          <Link href="/llms.txt" className="text-accent hover:underline">
            llms.txt
          </Link>{" "}
          instead (same content, no markup). The{" "}
          <Link href="/developers" className="text-accent hover:underline">
            developer page
          </Link>{" "}
          has the MCP config and endpoint reference.
        </div>
      </Container>
    </main>
  );
}
