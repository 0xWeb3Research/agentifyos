import { NextResponse } from "next/server";
import { readNightpassState, toolIdsOnChain, verifyPass } from "@/lib/nightpass";

/*
 * The verifier a visitor drives from /shielded.
 *
 * Read-only in both directions: it derives values with the contract's own
 * circuit code and asks the live chain whether they have been spent. It writes
 * nothing, and the secret it is handed is a throwaway generated in the
 * visitor's browser, so there is nothing here worth keeping.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const [state, toolIds] = await Promise.all([readNightpassState("preview"), toolIdsOnChain("preview")]);
  if (state === null) {
    return NextResponse.json({ error: "contract state unavailable" }, { status: 503 });
  }
  return NextResponse.json({
    contractAddress: state.deployment.contractAddress,
    network: state.deployment.network,
    readAt: state.readAt,
    counters: {
      tools: state.tools.length,
      passesIssued: state.passesIssued.toString(),
      callsRedeemed: state.callsRedeemed.toString(),
      attestations: state.attestations.toString(),
    },
    tools: state.tools.map((t) => ({
      toolId: t.toolId,
      slug: t.slug,
      priceAtomic: t.priceAtomic.toString(),
      quota: t.quota.toString(),
      callsServed: t.callsServed.toString(),
      active: t.active,
    })),
    toolIds,
  });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "expected a JSON body" }, { status: 400 });
  }

  const { slug, secretHex, nonceHex, calls, auditor } = (body ?? {}) as Record<string, unknown>;
  if (typeof slug !== "string" || typeof secretHex !== "string" || typeof nonceHex !== "string") {
    return NextResponse.json({ error: "slug, secretHex and nonceHex are required" }, { status: 400 });
  }

  try {
    const result = await verifyPass({
      slug,
      secretHex,
      nonceHex,
      calls: typeof calls === "number" ? calls : 3,
      auditor: typeof auditor === "string" && auditor ? auditor : "fca-uk",
    });
    if (result === null) {
      return NextResponse.json({ error: "contract state unavailable" }, { status: 503 });
    }
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "could not verify" },
      { status: 400 },
    );
  }
}
