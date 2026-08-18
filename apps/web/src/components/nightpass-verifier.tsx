"use client";

import { useCallback, useEffect, useState } from "react";
import { clsx } from "clsx";

/*
 * Three checks a visitor runs themselves, in order of how much they have to
 * take on trust.
 *
 * Step 2 is the honest centrepiece: SHA-256 in the visitor's own browser,
 * compared against ids read off the chain. Nothing we serve can fake it.
 */

type ToolRow = {
  toolId: string;
  slug: string | null;
  priceAtomic: string;
  quota: string;
  callsServed: string;
  active: boolean;
};

type StateResponse = {
  contractAddress: string;
  network: string;
  readAt: string;
  counters: { tools: number; passesIssued: string; callsRedeemed: string; attestations: string };
  tools: ToolRow[];
};

type NullifierCheck = { callIndex: number; nullifier: string; onChain: boolean };

type VerifyResponse = {
  commitment: string;
  auditTag: string;
  toolId: string;
  calls: NullifierCheck[];
  beyond: NullifierCheck;
  spentCallsTotal: string;
};

const short = (s: string, keep = 12) => (s.length <= keep * 2 ? s : `${s.slice(0, keep)}…${s.slice(-6)}`);

const randomHex = (bytes = 32) => {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
};

/** SHA-256 in the browser. This is what makes step 2 trustless. */
async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-border/60 py-1.5 last:border-0">
      <span className="label shrink-0 text-muted">{label}</span>
      <span className="min-w-0 break-all font-mono text-[11.5px] text-fg-secondary">{value}</span>
      {ok !== undefined && (
        <span className={clsx("label ml-auto shrink-0", ok ? "text-success" : "text-error")}>
          {ok ? "on chain" : "absent"}
        </span>
      )}
    </div>
  );
}

function Step({
  n,
  title,
  where,
  children,
}: {
  n: string;
  title: string;
  where: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="stat text-muted">{n}</span>
        <h3 className="text-[15px] font-medium tracking-[-0.01em]">{title}</h3>
        <span className="label ml-auto text-muted">{where}</span>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export type VerifierPrefill = { secretHex: string; nonceHex: string; slug: string; calls: number };

export function NightpassVerifier({ prefill }: { prefill?: VerifierPrefill | null }) {
  const [state, setState] = useState<StateResponse | null>(null);
  const [stateErr, setStateErr] = useState<string | null>(null);
  const [loadingState, setLoadingState] = useState(false);

  const [slug, setSlug] = useState("algo-market-data");
  const [browserHash, setBrowserHash] = useState<string | null>(null);

  const [secretHex, setSecretHex] = useState("");
  const [nonceHex, setNonceHex] = useState("");
  const [calls, setCalls] = useState(3);
  const [verify, setVerify] = useState<VerifyResponse | null>(null);
  const [verifyErr, setVerifyErr] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [adopted, setAdopted] = useState(false);

  useEffect(() => {
    setSecretHex(randomHex());
    setNonceHex(randomHex());
  }, []);

  // A pass handed over from the live run above. Adopting it is what turns this
  // from a demonstration into the visitor auditing their own calls.
  useEffect(() => {
    if (!prefill) return;
    setSecretHex(prefill.secretHex);
    setNonceHex(prefill.nonceHex);
    setSlug(prefill.slug);
    setCalls(Math.max(1, Math.min(5, prefill.calls)));
    setVerify(null);
    setAdopted(true);
  }, [prefill]);

  const loadState = useCallback(async () => {
    setLoadingState(true);
    setStateErr(null);
    try {
      const r = await fetch("/api/nightpass/verify", { cache: "no-store" });
      if (!r.ok) throw new Error((await r.json()).error ?? `HTTP ${r.status}`);
      setState(await r.json());
    } catch (e) {
      setStateErr(e instanceof Error ? e.message : "could not read the chain");
    } finally {
      setLoadingState(false);
    }
  }, []);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  useEffect(() => {
    void sha256Hex(slug).then(setBrowserHash);
  }, [slug]);

  const runVerify = useCallback(async () => {
    setVerifying(true);
    setVerifyErr(null);
    setVerify(null);
    try {
      const r = await fetch("/api/nightpass/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, secretHex, nonceHex, calls, auditor: "fca-uk" }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? `HTTP ${r.status}`);
      setVerify(await r.json());
    } catch (e) {
      setVerifyErr(e instanceof Error ? e.message : "could not verify");
    } finally {
      setVerifying(false);
    }
  }, [slug, secretHex, nonceHex, calls]);

  const onChainMatch = state?.tools.find((t) => t.toolId === browserHash) ?? null;

  const btn =
    "press rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-1.5 text-[13px] font-medium hover:border-border-hover disabled:opacity-40";

  return (
    <div className="mt-6 grid gap-3">
      {/* 1 ─────────────────────────────────────────────────────────────── */}
      <Step n="1" title="Read the contract off Midnight" where="live chain">
        <p className="text-[13px] leading-relaxed text-fg-secondary">
          Fetched from Midnight&apos;s public indexer, not from a database of ours.
          The same query is in the docs if you would rather run it yourself.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={loadState} disabled={loadingState} className={btn}>
            {loadingState ? "reading…" : "Read it again"}
          </button>
          {state && <span className="label text-muted">read at {new Date(state.readAt).toUTCString()}</span>}
        </div>
        {stateErr && <p className="mt-3 text-[13px] text-error">{stateErr}</p>}
        {state && (
          <div className="mt-3">
            <Row label="contract" value={state.contractAddress} />
            <Row label="tools" value={String(state.counters.tools)} />
            <Row label="passes issued" value={state.counters.passesIssued} />
            <Row label="calls redeemed" value={state.counters.callsRedeemed} />
            <Row label="attestations" value={state.counters.attestations} />
          </div>
        )}
      </Step>

      {/* 2 ─────────────────────────────────────────────────────────────── */}
      <Step n="2" title="Recompute a tool id yourself" where="your browser">
        <p className="text-[13px] leading-relaxed text-fg-secondary">
          The chain stores only <code className="font-mono text-[12px]">sha256(slug)</code>.
          Your browser hashes the name below with WebCrypto and compares it to what
          the contract holds, so the catalog cannot be relabelled without you noticing.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {["algo-market-data", "page-scraper", "text-summarizer", "not-a-real-tool"].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSlug(s)}
              className={clsx(btn, slug === s && "border-fg bg-tint")}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <Row label="your sha256" value={browserHash ?? "…"} />
          <Row
            label="on chain"
            value={onChainMatch ? onChainMatch.toolId : "no tool with this id"}
            ok={Boolean(onChainMatch)}
          />
          {onChainMatch && (
            <Row
              label="terms"
              value={`price ${(Number(onChainMatch.priceAtomic) / 1e6).toFixed(3)} · quota ${onChainMatch.quota} · served ${onChainMatch.callsServed}`}
            />
          )}
        </div>
      </Step>

      {/* 3 ─────────────────────────────────────────────────────────────── */}
      <Step n="3" title="Derive a pass and watch it stay unlinkable" where="our server, then the chain">
        <p className="text-[13px] leading-relaxed text-fg-secondary">
          {adopted
            ? "This is the pass you just bought above, and its secret is yours. Deriving needs Compact's hash, which runs on our server, but whether a nullifier has been spent is answered by the chain. The calls you spent should come back present, and the one after them absent: that is an auditor confirming an exact history."
            : "These are throwaway values your browser generated, so the pass below was never bought. Deriving needs Compact's hash, which runs on our server, but whether a nullifier has been spent is answered by the chain. Two things to look at: the nullifiers share nothing with each other, and none of them is on chain, because nobody paid for this pass."}
        </p>
        <div className="mt-3 grid gap-2">
          <Row label="secret" value={short(secretHex, 16)} />
          <Row label="nonce" value={short(nonceHex, 16)} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={runVerify} disabled={verifying} className={btn}>
            {verifying ? "deriving…" : "Derive and check"}
          </button>
          <button
            type="button"
            onClick={() => {
              setSecretHex(randomHex());
              setNonceHex(randomHex());
              setVerify(null);
              setAdopted(false);
            }}
            className={btn}
          >
            New secret
          </button>
          <label className="label flex items-center gap-1.5 text-muted">
            calls
            <select
              value={calls}
              onChange={(e) => setCalls(Number(e.target.value))}
              className="rounded-[var(--radius-sm)] border border-border bg-surface px-1.5 py-1 text-[13px] text-fg"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        {verifyErr && <p className="mt-3 text-[13px] text-error">{verifyErr}</p>}
        {verify && (
          <div className="mt-3">
            <Row label="commitment" value={verify.commitment} />
            <Row label="audit tag" value={verify.auditTag} />
            {verify.calls.map((c) => (
              <Row key={c.callIndex} label={`call ${c.callIndex}`} value={c.nullifier} ok={c.onChain} />
            ))}
            <Row
              label={`call ${verify.beyond.callIndex}`}
              value={verify.beyond.nullifier}
              ok={verify.beyond.onChain}
            />
            <p className="mt-3 text-[13px] leading-relaxed text-fg-secondary">
              Every nullifier above is unrelated to the ones beside it, even though
              they all come from one pass. That is what stops an observer joining a
              tool call to the agent that made it, or to its other calls. Change the
              secret and every value changes with it.
            </p>
          </div>
        )}
      </Step>
    </div>
  );
}
