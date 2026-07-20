#!/usr/bin/env -S npx tsx
// agentify · the AgentifyOS CLI. A real x402 client: it holds its own Casper key,
// hits the marketplace's paid endpoints over HTTP, gets a 402, signs, retries,
// and settles on Casper testnet.
//
//   pnpm agentify tools                        list the catalog
//   pnpm agentify search <query>               search it
//   pnpm agentify call <slug> [--k=v ...]      pay for a tool and get the result
//   pnpm agentify balance                      on-chain balances
//   pnpm agentify receipts                     recent settlements
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getCsprBalance, getWcsprBalance, loadWalletFromFile } from "../src/lib/x402/casper";
import { fetchWithPayment, searchTools } from "../src/lib/x402/client";

const here = dirname(fileURLToPath(import.meta.url));
const KEYS = join(here, "..", "keys");
// Ships pointing at the hosted marketplace; set AGENTIFYOS_URL to
// http://localhost:8402 to run against a local dev server.
const BASE = process.env.AGENTIFYOS_URL || "https://agentifyos.xyz";

const c = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
};

// Server responses are untrusted: strip ANSI escapes / control chars so a
// crafted tool name or description can't redraw the terminal (e.g. overwrite
// the price column). Apply BEFORE any truncation.
const safe = (s: unknown) => String(s ?? "").replace(/[\u0000-\u001f\u007f-\u009f]/g, "");

const argv = process.argv.slice(2);
const cmd = argv[0] ?? "help";
const rest = argv.slice(1);
const flag = (name: string, def?: string) => {
  const hit = rest.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : def;
};

function usd(n: number) {
  return n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;
}

async function main() {
  switch (cmd) {
    case "tools":
    case "search": {
      const query = cmd === "search" ? rest.filter((a) => !a.startsWith("--")).join(" ") : "";
      const tools = await searchTools(BASE, query);
      if (!tools.length) return console.log(c.dim("  no tools found"));
      console.log(c.bold(`\n  ${tools.length} tool${tools.length === 1 ? "" : "s"}${query ? ` matching "${query}"` : ""}\n`));
      for (const t of tools) {
        const price = (t.price as { usd?: number } | undefined)?.usd ?? 0;
        const stats = (t.stats as { calls?: number; successRate?: number } | undefined) ?? {};
        console.log(
          `  ${c.bold(safe(t.name).padEnd(22))} ${c.green(usd(price).padStart(8))}/call  ` +
            c.dim(`${stats.calls ?? 0} calls · ${((stats.successRate ?? 0) * 100).toFixed(1)}%`),
        );
        console.log(`  ${c.dim(safe(t.description).slice(0, 88))}`);
        console.log(`  ${c.blue(safe(t.resource))}\n`);
      }
      break;
    }

    case "call": {
      const slug = rest[0];
      if (!slug) return console.log(c.red("  usage: agentify call <slug> [--key=value ...]"));
      // remaining --k=v become query params for the tool
      const params = new URLSearchParams();
      for (const a of rest.slice(1)) {
        if (a.startsWith("--") && a.includes("=")) {
          const [k, ...v] = a.slice(2).split("=");
          if (!["max", "key"].includes(k)) params.set(k, v.join("="));
        }
      }
      const keyName = flag("key", "agent")!;
      const wallet = loadWalletFromFile(join(KEYS, `${keyName}.pem`));
      const url = `${BASE}/api/t/${slug}${params.toString() ? `?${params}` : ""}`;

      // --max is a safety cap: Number("abc") is NaN, which passes every
      // comparison and silently disables the cap. Fail closed instead.
      const maxUsd = Number(flag("max", "1"));
      if (!Number.isFinite(maxUsd) || maxUsd <= 0) {
        console.log(c.red(`  --max must be a positive number, got: ${flag("max")}`));
        process.exit(1);
      }

      console.log(c.bold(`\n  paying for ${slug}`));
      console.log(c.dim(`  wallet ${wallet.publicKeyHex.slice(0, 20)}…  (holds WCSPR, no CSPR needed)\n`));

      const out = await fetchWithPayment(url, wallet, {
        maxUsd,
        onStep: (s) => {
          const tag =
            s.kind === "402" ? c.yellow("402") :
            s.kind === "sign" ? c.blue("SIG") :
            s.kind === "paid" ? c.green("PAID") :
            s.kind === "error" ? c.red("ERR") : c.dim("REQ");
          console.log(`  ${tag.padEnd(14)} ${safe(s.label)}  ${c.dim(`+${s.atMs}ms`)}`);
        },
      });

      if (!out.ok) {
        console.log(c.red(`\n  failed: ${safe(out.error)}\n`));
        process.exit(1);
      }
      console.log(c.bold("\n  result"));
      console.log(
        // JSON.stringify escapes C0 controls; safe() per line strips any raw
        // C1/DEL bytes without touching the formatter's own newlines.
        JSON.stringify(out.result, null, 2)
          .split("\n")
          .map((l) => "    " + safe(l))
          .join("\n"),
      );
      if (out.receipt) {
        console.log(c.bold("\n  receipt"));
        console.log(`    cost      ${c.green(usd(out.receipt.costUsd))}`);
        console.log(`    deploy    ${safe(out.receipt.deployHash)}`);
        console.log(`    explorer  ${c.blue(safe(out.receipt.explorerUrl))}`);
      }
      console.log();
      break;
    }

    case "balance": {
      console.log(c.bold("\n  Casper testnet balances\n"));
      for (const role of ["facilitator", "agent", "treasury"]) {
        try {
          const w = loadWalletFromFile(join(KEYS, `${role}.pem`));
          const [cspr, wcspr] = await Promise.all([
            getCsprBalance(w.publicKeyHex),
            getWcsprBalance(w.accountHash),
          ]);
          console.log(
            `  ${role.padEnd(12)} ${(Number(cspr) / 1e9).toFixed(4).padStart(12)} CSPR   ` +
              `${(Number(wcspr) / 1e9).toFixed(4).padStart(12)} WCSPR`,
          );
        } catch {
          console.log(`  ${role.padEnd(12)} ${c.dim("(no key: run pnpm casper:keygen)")}`);
        }
      }
      console.log();
      break;
    }

    case "receipts": {
      const res = await fetch(`${BASE}/api/settlements?limit=10`);
      const { settlements = [] } = (await res.json()) as { settlements?: Array<Record<string, unknown>> };
      console.log(c.bold(`\n  ${settlements.length} recent settlements\n`));
      for (const s of settlements) {
        console.log(
          `  ${c.dim(safe(s.payerLabel).padEnd(10))} ${safe(s.toolName).padEnd(20)} ` +
            `${c.green(usd(Number(s.amountUsd)).padStart(8))}  ${c.dim(safe(s.deployHash).slice(0, 16) + "…")}`,
        );
      }
      console.log();
      break;
    }

    default:
      console.log(`
  ${c.bold("agentify")} · pay for tools with x402 on Casper

    ${c.bold("tools")}                      list the catalog
    ${c.bold("search")} <query>             search for a tool
    ${c.bold("call")} <slug> [--k=v]        pay for a tool and get its result
    ${c.bold("balance")}                    on-chain CSPR + WCSPR balances
    ${c.bold("receipts")}                   recent settlements

  options
    --key=<role>   which key signs (default: agent)
    --max=<usd>    refuse to pay more than this (default: 1)

  env
    AGENTIFYOS_URL   marketplace base URL (default https://agentifyos.xyz)
`);
  }
}

main().catch((e) => {
  console.error(c.red(`\n  ${e instanceof Error ? e.message : String(e)}\n`));
  process.exit(1);
});
