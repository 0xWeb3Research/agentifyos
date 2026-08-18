import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  attestFor,
  ensureStarted,
  issuePassFor,
  newSessionId,
  redeemCallFor,
  revealSecretFor,
  status,
} from "@/lib/nightpass-agent";
import { readSpend, reserveSpend } from "@/lib/security/spend";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/security/ratelimit";

/*
 * The live run a visitor drives from /shielded.
 *
 * Every action here settles a real transaction on Midnight out of a funded
 * wallet, so it is bounded twice over: per-IP rate limiting caps how fast one
 * client can spend, and a daily allowance caps how much the wallet can lose in
 * total. Midnight is metered in transactions rather than dollars, because DUST
 * regenerates from held NIGHT and has no price.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 300;

const SESSION_COOKIE = "nightpass-session";
const DEMO_SLUG = "algo-market-data";
const DEMO_QUOTA = 5;

async function sessionId(): Promise<{ id: string; isNew: boolean }> {
  const jar = await cookies();
  const existing = jar.get(SESSION_COOKIE)?.value;
  if (existing && /^[0-9a-f]{32}$/.test(existing)) return { id: existing, isNew: false };
  return { id: newSessionId(), isNew: true };
}

const withSession = (res: NextResponse, id: string, isNew: boolean) => {
  if (isNew) {
    // Not a credential, just a handle onto a throwaway demo pass.
    res.cookies.set(SESSION_COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 6,
    });
  }
  return res;
};

export async function GET() {
  // Touching the endpoint is what starts the wallet warming up, so the first
  // visitor to open the page begins the sync rather than the first to click.
  const agent = ensureStarted();
  const { id, isNew } = await sessionId();
  const [budget, pass] = await Promise.all([readSpend("midnight"), Promise.resolve(revealSecretFor(id))]);

  return withSession(
    NextResponse.json({
      agent,
      budget,
      pass,
      demo: { slug: DEMO_SLUG, quota: DEMO_QUOTA },
    }),
    id,
    isNew,
  );
}

export async function POST(req: Request) {
  ensureStarted();

  const ip = clientIp(req);
  const limited = rateLimit(`nightpass-run:${ip}`, 12, 60_000);
  if (!limited.ok) return tooManyRequests(limited.retryAfterSec);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "expected a JSON body" }, { status: 400 });
  }
  const action = (body as { action?: unknown })?.action;
  if (action !== "issuePass" && action !== "redeemCall" && action !== "attest") {
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }

  const { id, isNew } = await sessionId();

  // One transaction per action. Reserved before the work runs.
  const budget = await reserveSpend("midnight", 1);
  if (!budget.ok) {
    return withSession(
      NextResponse.json(
        {
          error: "daily_demo_budget_reached",
          reason: `today's live demo allowance of ${budget.cap} transactions is used up. It resets at midnight UTC. Everything on this page still verifies against the chain, and the repo runs the same flow locally.`,
          budget,
        },
        { status: 429 },
      ),
      id,
      isNew,
    );
  }

  try {
    const result =
      action === "issuePass"
        ? await issuePassFor(id, DEMO_SLUG, DEMO_QUOTA)
        : action === "redeemCall"
          ? await redeemCallFor(id)
          : await attestFor(id, "fca-uk");

    return withSession(
      NextResponse.json({
        action,
        ...result,
        agent: status(),
        budget: await readSpend("midnight"),
        pass: revealSecretFor(id),
      }),
      id,
      isNew,
    );
  } catch (e) {
    return withSession(
      NextResponse.json(
        {
          error: e instanceof Error ? e.message : "the run failed",
          agent: status(),
          budget: await readSpend("midnight"),
        },
        { status: 409 },
      ),
      id,
      isNew,
    );
  }
}
