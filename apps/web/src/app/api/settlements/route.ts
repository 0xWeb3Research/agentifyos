import { NextResponse } from "next/server";
import { getSettlements } from "@/lib/data";

// The live-feed poll target. Never cached — the in-memory ledger moves as
// settlements are recorded during the session, and the feed must see it.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return NextResponse.json({
    settlements: getSettlements(Number(new URL(req.url).searchParams.get("limit")) || 16),
  });
}
