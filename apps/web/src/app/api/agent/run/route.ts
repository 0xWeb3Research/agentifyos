import { NextResponse } from "next/server";
import { getToolsWithStats } from "@/lib/data";
import { MODE } from "@/lib/config";

// Real-mode settlement POSTs a signed transaction to the Casper RPC. Next patches
// global fetch and its caching layer mangles that body (the node answers 413), so
// this segment opts out entirely and runs on the Node runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 300;
import { hashResult, makeWallet } from "@/lib/x402/payment";
import { executePaidCall, planTask } from "@/lib/x402/loop";
import type { WireStep } from "@/lib/x402/loop";
import type { Receipt } from "@/lib/types";

// The agent runner. Plans a task into an ordered list of live tools, then walks
// the x402 handshake for each one in-process — threading the result of each call
// into the next — while metering spend against a wallet budget. The client
// replays the returned trace progressively so the demo feels live.

interface AgentStep {
  reason: string;
  slug: string;
  toolName: string;
  ok: boolean;
  costUsd: number;
  wireSteps: WireStep[];
  result?: unknown;
  receipt?: Receipt;
  error?: string;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    task?: unknown;
    budgetUsd?: unknown;
  };
  const task = typeof body.task === "string" ? body.task : "";
  const budgetUsd =
    typeof body.budgetUsd === "number" && Number.isFinite(body.budgetUsd)
      ? body.budgetUsd
      : undefined;

  const tools = getToolsWithStats();
  const wallet = makeWallet("demo-agent", "atlas-01");
  const baseUrl = new URL(req.url).origin;
  const plan = planTask(task, tools);

  // Context threaded between calls — the agent reasons over prior outputs.
  const ctx: { markdown?: string; lastResult?: unknown } = {};
  let remaining = budgetUsd ?? 0.1;
  let totalCostUsd = 0;
  const steps: AgentStep[] = [];

  for (const p of plan) {
    const tool = tools.find((t) => t.slug === p.slug);
    if (!tool) continue;

    // Wire each tool's input from the running context.
    const input: Record<string, unknown> = { ...p.input };
    if (p.slug === "text-summarizer") {
      input.text = ctx.markdown ?? JSON.stringify(ctx.lastResult ?? {});
    } else if (p.slug === "rwa-attestor") {
      input.documentHash = hashResult(ctx.lastResult ?? {});
    }
    // page-scraper keeps its planned input.url as-is.

    const call = await executePaidCall({
      tool,
      wallet,
      input,
      budgetRemainingUsd: remaining,
      baseUrl,
    });

    if (call.ok) {
      remaining = +(remaining - call.costUsd).toFixed(4);
      totalCostUsd = +(totalCostUsd + call.costUsd).toFixed(4);
      const result = call.result as { markdown?: unknown } | null | undefined;
      if (result && typeof result === "object" && typeof result.markdown === "string") {
        ctx.markdown = result.markdown;
      }
      ctx.lastResult = call.result;
    }

    steps.push({
      reason: p.reason,
      slug: p.slug,
      toolName: tool.name,
      ok: call.ok,
      costUsd: call.costUsd,
      wireSteps: call.steps,
      result: call.result,
      receipt: call.receipt,
      error: call.error,
    });

    // The agent stops the moment it can't pay (or a call fails).
    if (!call.ok) break;
  }

  const ok = steps.length > 0 && steps.every((s) => s.ok);

  // In real mode the on-chain payer is the Casper key in keys/agent.pem, not the
  // in-process demo wallet — report the identity that actually signed.
  let shown = { accountHash: wallet.accountHash, publicKey: wallet.publicKey, label: wallet.label };
  if (MODE === "real") {
    try {
      const casper = await import("@/lib/x402/casper");
      const path = await import("node:path");
      const real = casper.loadWalletFromFile(
        process.env.AGENT_KEY_PEM
          ? path.resolve(process.cwd(), process.env.AGENT_KEY_PEM)
          : path.join(process.cwd(), "keys", "agent.pem"),
      );
      shown = { accountHash: real.address, publicKey: real.publicKeyHex, label: "agent" };
    } catch {
      /* fall back to the demo identity if keys are unavailable */
    }
  }

  return NextResponse.json({
    ok,
    task,
    wallet: shown,
    budgetUsd: budgetUsd ?? 0.1,
    budgetRemainingUsd: remaining,
    totalCostUsd,
    steps,
  });
}
