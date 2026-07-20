import { promises as fs } from "node:fs";
import path from "node:path";

// The docs rendered on /docs are the same markdown files that live in the repo
// at docs/; there is no second copy to keep in sync. Reading them at request
// time means a doc edit shows up on the site without touching a component.

export interface DocMeta {
  slug: string;
  file: string;
  title: string;
  summary: string;
  minutes: number;
}

// Curated order and framing. Alphabetical would open on ADDRESSES, which is the
// worst possible first page for someone arriving with no context.
const MANIFEST: Omit<DocMeta, "minutes">[] = [
  {
    slug: "start-here",
    file: "START-HERE.md",
    title: "Start here",
    summary:
      "Zero assumed knowledge. What an AI agent is, why it needs to pay for things, and what any of this has to do with a blockchain.",
  },
  {
    slug: "how-it-works",
    file: "HOW-IT-WORKS.md",
    title: "How it works",
    summary:
      "The x402 handshake end to end: the 402 quote, the signature, the settlement, and the receipt. Includes the contract call we make.",
  },
  {
    slug: "testnet",
    file: "TESTNET.md",
    title: "Testnet runbook",
    summary:
      "Get a wallet, claim faucet tokens, fund the accounts, and push a real payment through. Follow it top to bottom and it works.",
  },
  {
    slug: "cli-and-mcp",
    file: "CLI-AND-MCP.md",
    title: "CLI and MCP",
    summary:
      "Use the marketplace from a terminal, or wire it into Claude Desktop and Cursor so an assistant can buy tools on its own.",
  },
  {
    slug: "addresses",
    file: "ADDRESSES.md",
    title: "Addresses",
    summary:
      "Every account, contract hash, entry point, gas budget, and port. The reference you keep open in a second tab.",
  },
  {
    slug: "proof",
    file: "PROOF.md",
    title: "Proof",
    summary:
      "Transaction hashes for settlements that actually happened, and how to verify each one yourself on the block explorer.",
  },
];

// process.cwd() is apps/web under both `next dev` and `next start`; the repo
// root is two levels up. The second candidate covers a flattened deploy layout.
async function docsDir(): Promise<string> {
  const candidates = [
    path.join(process.cwd(), "..", "..", "docs"),
    path.join(process.cwd(), "docs"),
  ];
  for (const dir of candidates) {
    try {
      await fs.access(dir);
      return dir;
    } catch {
      /* try the next one */
    }
  }
  return candidates[0];
}

function readingMinutes(markdown: string): number {
  return Math.max(1, Math.round(markdown.split(/\s+/).length / 220));
}

/** Rewrite repo-relative links so they work as site routes. */
function rewriteLinks(markdown: string): string {
  return markdown.replace(/\]\(\.\/([A-Z0-9-]+)\.md\)/g, (_m, name: string) => {
    const hit = MANIFEST.find((d) => d.file === `${name}.md`);
    return hit ? `](/docs/${hit.slug})` : `](/docs)`;
  });
}

export async function getDoc(
  slug: string,
): Promise<{ meta: DocMeta; body: string } | null> {
  const entry = MANIFEST.find((d) => d.slug === slug);
  if (!entry) return null;
  let raw: string;
  try {
    raw = await fs.readFile(path.join(await docsDir(), entry.file), "utf8");
  } catch {
    return null;
  }
  // The page renders its own <h1>, so drop the one the file opens with.
  const body = rewriteLinks(raw.replace(/^#\s+.*\n+/, ""));
  return { meta: { ...entry, minutes: readingMinutes(raw) }, body };
}

export async function listDocs(): Promise<DocMeta[]> {
  const dir = await docsDir();
  const out: DocMeta[] = [];
  for (const entry of MANIFEST) {
    try {
      const raw = await fs.readFile(path.join(dir, entry.file), "utf8");
      out.push({ ...entry, minutes: readingMinutes(raw) });
    } catch {
      // A missing file is a packaging problem, not a reason to 500 the index.
    }
  }
  return out;
}

export const DOC_SLUGS = MANIFEST.map((d) => d.slug);
