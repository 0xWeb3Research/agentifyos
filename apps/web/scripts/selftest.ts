/**
 * Offline crypto self-test for the AgentifyOS x402 payment loop.
 *
 * No network, no dev server: this exercises the real Ed25519 signing/verify
 * path, the mock facilitator's replay guard, and the full paid-call handshake
 * entirely in-process. Run with:  pnpm exec tsx scripts/selftest.ts
 *
 * MODE defaults to "mock" (see ../src/lib/config), which is what these cases
 * assume: the mock facilitator settles in-process with a deterministic
 * pseudo deploy hash.
 */
import {
  buildPayload,
  buildRequirements,
  makeWallet,
  verifySignature,
} from "../src/lib/x402/payment";
import { executePaidCall } from "../src/lib/x402/loop";
import { __resetNonces, getFacilitator } from "../src/lib/x402/facilitator";
import { getToolsWithStats } from "../src/lib/data";
import type { ToolWithStats } from "../src/lib/types";

// ── tiny assertion harness ──────────────────────────────────────────────────
let passed = 0;
let total = 0;

async function runCase(
  name: string,
  fn: () => boolean | Promise<boolean>,
): Promise<void> {
  total++;
  try {
    const ok = await fn();
    if (ok) {
      passed++;
      console.log(`  ✓ PASS  ${name}`);
    } else {
      console.log(`  ✗ FAIL  ${name}`);
    }
  } catch (err) {
    console.log(`  ✗ FAIL  ${name} · threw: ${(err as Error).message}`);
  }
}

function firstHandlerTool(): ToolWithStats {
  const tool = getToolsWithStats().find((t) => t.handler);
  if (!tool) throw new Error("no tool with a live handler in the catalog");
  return tool;
}

const BASE_URL = "http://localhost:8402";

// ── cases ───────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log("\nAgentifyOS x402 offline self-test\n");

  // 1. Deterministic wallet: same seed → same account hash; different seed → different.
  await runCase("deterministic wallet", () => {
    const a1 = makeWallet("x", "a").accountHash;
    const a2 = makeWallet("x", "a").accountHash;
    const b = makeWallet("y", "a").accountHash;
    return a1 === a2 && a1 !== b;
  });

  // 2. Valid signature: a freshly-signed authorization verifies against its public key.
  await runCase("valid signature", () => {
    const tool = firstHandlerTool();
    const event = tool.priceEvents[0];
    const wallet = makeWallet("agent-sig", "agent-sig");
    const req = buildRequirements(
      tool,
      event,
      "http://x/api/t/" + tool.slug,
      tool.publisher.payTo,
    );
    const payload = buildPayload(wallet, req);
    return (
      verifySignature(
        payload.payload.authorization,
        payload.payload.signature,
        payload.payload.publicKey,
      ) === true
    );
  });

  // 3. Tamper detection: mutating the signed value invalidates the signature.
  await runCase("tamper detection", () => {
    const tool = firstHandlerTool();
    const event = tool.priceEvents[0];
    const wallet = makeWallet("agent-tamper", "agent-tamper");
    const req = buildRequirements(
      tool,
      event,
      "http://x/api/t/" + tool.slug,
      tool.publisher.payTo,
    );
    const payload = buildPayload(wallet, req);
    payload.payload.authorization.value = "999999999"; // mutate after signing
    return (
      verifySignature(
        payload.payload.authorization,
        payload.payload.signature,
        payload.payload.publicKey,
      ) === false
    );
  });

  // 4. Full paid call (mock): the end-to-end handshake settles and issues a receipt.
  await runCase("full paid call (mock)", async () => {
    __resetNonces();
    const tool = firstHandlerTool();
    const r = await executePaidCall({
      tool,
      wallet: makeWallet("t", "t"),
      input: {},
      budgetRemainingUsd: 1,
      baseUrl: BASE_URL,
    });
    const settleStep = r.steps.find((s) => s.kind === "settle");
    const receiptStep = r.steps.find((s) => s.kind === "receipt");
    return (
      r.ok === true &&
      !!r.receipt?.deployHash &&
      !!r.result &&
      !!settleStep &&
      settleStep.ok === true &&
      !!receiptStep
    );
  });

  // 5. Replay guard: the same (nonce, resource) may settle at most once.
  await runCase("replay guard", async () => {
    __resetNonces();
    const tool = firstHandlerTool();
    const event = tool.priceEvents[0];
    const wallet = makeWallet("agent-replay", "agent-replay");
    const resource = BASE_URL + "/api/t/" + tool.slug;
    const req = buildRequirements(tool, event, resource, tool.publisher.payTo);
    const payload = buildPayload(wallet, req);
    const fac = getFacilitator();
    const first = await fac.settle(payload, req);
    const second = await fac.settle(payload, req);
    return (
      first.success === true &&
      second.success === false &&
      second.errorReason === "nonce_replayed"
    );
  });

  // 6. Amount mismatch: verifying a valid payload against a requirement with a
  //    different amount must fail (the signature covers the amount).
  await runCase("amount mismatch", async () => {
    const tool = firstHandlerTool();
    const event = tool.priceEvents[0];
    const wallet = makeWallet("agent-amount", "agent-amount");
    const req = buildRequirements(
      tool,
      event,
      "http://x/api/t/" + tool.slug,
      tool.publisher.payTo,
    );
    const payload = buildPayload(wallet, req);
    const otherReq = { ...req, amount: req.amount === "1" ? "2" : "1" };
    const fac = getFacilitator();
    const v = await fac.verify(payload, otherReq);
    return v.isValid === false;
  });

  // ── summary ─────────────────────────────────────────────────────────────
  console.log(`\n${passed}/${total} passed\n`);
  if (passed !== total) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
