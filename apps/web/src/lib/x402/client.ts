// A real x402 HTTP client. Call a paid endpoint, get HTTP 402 with the price,
// sign a payment authorization with your OWN Casper key, retry with the
// PAYMENT-SIGNATURE header, receive the result + an on-chain receipt.
//
// This is what an external agent does — our CLI and MCP server both use it, so
// the 402 handshake is exercised over the wire rather than short-circuited
// in-process. Server-only (needs the Casper key material).
import {
  loadWalletFromFile,
  signPayment,
  type CasperPaymentRequirements,
  type CasperWallet,
} from "./casper";

export interface PaidFetchStep {
  kind: "request" | "402" | "sign" | "paid" | "error";
  label: string;
  detail?: unknown;
  atMs: number;
}

export interface PaidFetchResult {
  ok: boolean;
  status: number;
  result?: unknown;
  receipt?: {
    tool: string;
    event: string;
    costUsd: number;
    payer: string;
    deployHash: string;
    resultHash: string;
    network: string;
    explorerUrl: string;
    createdAt: string;
  };
  requirements?: CasperPaymentRequirements;
  error?: string;
  steps: PaidFetchStep[];
}

export interface PaidFetchOptions {
  /** Refuse to pay more than this (USD). */
  maxUsd?: number;
  /** Called as each step happens, for live CLI output. */
  onStep?: (s: PaidFetchStep) => void;
  fetchImpl?: typeof fetch;
}

export function walletFromPem(pemPath: string): CasperWallet {
  return loadWalletFromFile(pemPath);
}

/** Estimate the USD price of a 402 challenge, for budget checks. */
function usdOf(req: CasperPaymentRequirements, csprPriceUsd = 0.0231): number {
  const decimals = Number(req.extra?.decimals ?? 9);
  return (Number(req.amount) / 10 ** decimals) * csprPriceUsd;
}

export async function fetchWithPayment(
  url: string,
  wallet: CasperWallet,
  opts: PaidFetchOptions = {},
): Promise<PaidFetchResult> {
  const doFetch = opts.fetchImpl ?? fetch;
  const start = Date.now();
  const steps: PaidFetchStep[] = [];
  const step = (kind: PaidFetchStep["kind"], label: string, detail?: unknown) => {
    const s: PaidFetchStep = { kind, label, detail, atMs: Date.now() - start };
    steps.push(s);
    opts.onStep?.(s);
    return s;
  };

  step("request", `GET ${url}`);
  const first = await doFetch(url, { headers: { accept: "application/json" } });

  // Already free / cached? Just return it.
  if (first.status !== 402) {
    const body = await first.json().catch(() => null);
    return { ok: first.ok, status: first.status, result: body, steps };
  }

  const challenge = (await first.json().catch(() => null)) as
    | { accepts?: CasperPaymentRequirements[] }
    | null;
  const requirements = challenge?.accepts?.[0];
  if (!requirements) {
    step("error", "402 without usable payment requirements");
    return { ok: false, status: 402, error: "no_payment_requirements", steps };
  }

  const priceUsd = usdOf(requirements);
  step("402", `payment required: ${requirements.amount} atomic ${requirements.extra?.symbol ?? "WCSPR"} (~$${priceUsd.toFixed(4)})`, requirements);

  if (typeof opts.maxUsd === "number" && priceUsd > opts.maxUsd + 1e-9) {
    step("error", `price $${priceUsd.toFixed(4)} exceeds budget $${opts.maxUsd}`);
    return { ok: false, status: 402, error: "over_budget", requirements, steps };
  }

  const payload = signPayment(wallet, requirements);
  step("sign", `signed EIP-712 authorization as ${wallet.address.slice(0, 12)}…`, {
    signature: payload.signature.slice(0, 24) + "…",
    nonce: payload.authorization.nonce.slice(0, 16) + "…",
  });

  const header = Buffer.from(JSON.stringify(payload)).toString("base64");
  const paid = await doFetch(url, {
    headers: { accept: "application/json", "PAYMENT-SIGNATURE": header },
  });
  const body = (await paid.json().catch(() => null)) as
    | { result?: unknown; receipt?: PaidFetchResult["receipt"]; error?: string }
    | null;

  if (!paid.ok) {
    step("error", `payment rejected: ${body?.error ?? paid.status}`);
    return { ok: false, status: paid.status, error: body?.error ?? String(paid.status), requirements, steps };
  }

  step("paid", `settled · ${body?.receipt?.deployHash?.slice(0, 16) ?? "?"}…`, body?.receipt);
  return {
    ok: true,
    status: paid.status,
    result: body?.result,
    receipt: body?.receipt,
    requirements,
    steps,
  };
}

/** Discovery: what can I buy here? */
export async function searchTools(
  baseUrl: string,
  query = "",
  fetchImpl: typeof fetch = fetch,
): Promise<Array<Record<string, unknown>>> {
  const url = query
    ? `${baseUrl}/api/discovery/search?query=${encodeURIComponent(query)}`
    : `${baseUrl}/api/discovery/resources`;
  const res = await fetchImpl(url, { headers: { accept: "application/json" } });
  const body = (await res.json().catch(() => null)) as { resources?: Array<Record<string, unknown>> } | null;
  return body?.resources ?? [];
}
