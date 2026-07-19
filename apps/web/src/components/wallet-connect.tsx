"use client";

import { useCallback, useEffect, useState } from "react";
import { clsx } from "clsx";
import { Button, Chip } from "./ui";

// ── Casper Wallet browser extension ─────────────────────────────────────────
// The extension exposes a provider factory on window. We only need three calls:
// connect, read the active key, and sign a message. The extension prefixes the
// message with "Casper Message:\n" before signing — the server verifies against
// exactly that preimage.
type Provider = {
  requestConnection(): Promise<boolean>;
  disconnectFromSite(): Promise<boolean>;
  getActivePublicKey(): Promise<string>;
  signMessage(message: string, signingPublicKey: string): Promise<{ cancelled?: boolean; signatureHex?: string; signature?: string }>;
};

function getProvider(): Provider | null {
  const w = window as unknown as {
    CasperWalletProvider?: () => Provider;
    casperWallet?: Provider;
  };
  if (typeof w.CasperWalletProvider === "function") return w.CasperWalletProvider();
  return w.casperWallet ?? null;
}

export interface SessionInfo {
  publicKey: string;
  accountHash: string;
  address: string;
}

export function WalletConnect({
  onSession,
  className,
}: {
  onSession?: (s: SessionInfo | null) => void;
  className?: string;
}) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasWallet, setHasWallet] = useState<boolean | null>(null);

  useEffect(() => {
    // The extension injects asynchronously; give it a moment before deciding.
    const t = setTimeout(() => setHasWallet(!!getProvider()), 600);
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d: { session: SessionInfo | null }) => {
        if (d.session) {
          setSession(d.session);
          onSession?.(d.session);
        }
      })
      .catch(() => {});
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    const provider = getProvider();
    if (!provider) {
      setError("Casper Wallet not found — install the extension, then reload.");
      return;
    }
    setBusy(true);
    try {
      await provider.requestConnection();
      const publicKey = await provider.getActivePublicKey();

      // 1. ask the server for a one-time challenge
      const challenge = (await (
        await fetch("/api/auth/challenge", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ accountHash: publicKey }),
        })
      ).json()) as { message: string };

      // 2. sign it in the wallet
      const signed = await provider.signMessage(challenge.message, publicKey);
      if (signed?.cancelled) {
        setError("Signing was cancelled.");
        return;
      }
      const signature = signed?.signatureHex ?? signed?.signature;
      if (!signature) {
        setError("The wallet returned no signature.");
        return;
      }

      // 3. exchange it for a session
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ publicKey, message: challenge.message, signature }),
      });
      const body = (await res.json()) as SessionInfo & { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Could not verify that signature.");
        return;
      }
      const s: SessionInfo = {
        publicKey: body.publicKey,
        accountHash: body.accountHash,
        address: body.address,
      };
      setSession(s);
      onSession?.(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wallet connection failed.");
    } finally {
      setBusy(false);
    }
  }, [onSession]);

  const disconnect = useCallback(async () => {
    await fetch("/api/auth/session", { method: "DELETE" }).catch(() => {});
    try {
      await getProvider()?.disconnectFromSite();
    } catch {
      /* the site session is what matters */
    }
    setSession(null);
    onSession?.(null);
  }, [onSession]);

  if (session) {
    return (
      <div className={clsx("flex flex-wrap items-center gap-2.5", className)}>
        <Chip tone="success">signed in</Chip>
        <span className="stat truncate text-fg-secondary" title={session.publicKey}>
          {session.publicKey.slice(0, 10)}…{session.publicKey.slice(-6)}
        </span>
        <button
          type="button"
          onClick={disconnect}
          className="press label text-muted transition-colors hover:text-fg"
        >
          sign out
        </button>
      </div>
    );
  }

  return (
    <div className={clsx("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={connect} disabled={busy} size="sm">
          {busy ? "Check your wallet…" : "Connect Casper Wallet"}
        </Button>
        {hasWallet === false && (
          <a
            href="https://www.casperwallet.io"
            target="_blank"
            rel="noreferrer"
            className="label text-accent hover:underline"
          >
            get the extension ↗
          </a>
        )}
      </div>
      {error && <p className="stat text-error">{error}</p>}
    </div>
  );
}
