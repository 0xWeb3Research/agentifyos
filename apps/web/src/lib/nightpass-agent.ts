/*
 * The funded agent behind the live demo on /shielded.
 *
 * A visitor cannot transact on Midnight from a browser: proving needs a proof
 * server and a funded wallet, and proving locally is the whole privacy story,
 * so it is not something to hand to a stranger's tab. Instead the server keeps
 * one warm wallet and acts for each visitor, giving every visitor their OWN
 * pass secret so the result is genuinely theirs to audit afterwards.
 *
 * Two things shape the design:
 *
 *   A first wallet sync walks ~110k index entries and takes 10-15 minutes, so
 *   it runs once in the background and the UI reports progress rather than
 *   hanging a request on it.
 *
 *   One wallet cannot sign two transactions at once without fighting itself
 *   over the same coins, so every operation goes through a queue.
 */

import "server-only";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { readDeployment, type NightpassNetwork } from "./nightpass";

const NETWORK: NightpassNetwork =
  (process.env.NIGHTPASS_NETWORK as NightpassNetwork) === "preprod" ? "preprod" : "preview";

const INDEXER = {
  preview: {
    http: "https://indexer.preview.midnight.network/api/v3/graphql",
    ws: "wss://indexer.preview.midnight.network/api/v3/graphql/ws",
    node: "https://rpc.preview.midnight.network",
  },
  preprod: {
    http: "https://indexer.preprod.midnight.network/api/v3/graphql",
    ws: "wss://indexer.preprod.midnight.network/api/v3/graphql/ws",
    node: "https://rpc.preprod.midnight.network",
  },
}[NETWORK];

const PROOF_SERVER = process.env.NIGHTPASS_PROOF_SERVER ?? "http://127.0.0.1:6300";
const ZK_CONFIG_PATH = path.resolve(
  process.cwd(),
  "..",
  "..",
  "midnight",
  "contract",
  "src",
  "managed",
  "nightpass",
);
const PRIVATE_STATE_ID = "nightpassPrivateState";

export type AgentPhase = "unconfigured" | "starting" | "syncing" | "ready" | "error";

export interface AgentStatus {
  phase: AgentPhase;
  /** 0-100 across the three sub-wallets, or null before the first report. */
  progress: number | null;
  message: string;
  network: NightpassNetwork;
  contractAddress: string | null;
  queueDepth: number;
}

export interface RunResult {
  txId: string;
  blockHeight: number;
  value: string;
}

const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");

// ── the singleton ───────────────────────────────────────────────────────────
// Kept on globalThis so a dev-mode hot reload does not start a second wallet
// and race the first one over the same coins.

interface AgentRuntime {
  phase: AgentPhase;
  progress: number | null;
  message: string;
  contract: unknown;
  providers: unknown;
  queue: Promise<unknown>;
  queueDepth: number;
  startedAt: number;
}

const g = globalThis as unknown as { __nightpassAgent?: AgentRuntime };

const runtime = (g.__nightpassAgent ??= {
  phase: "starting",
  progress: null,
  message: "not started",
  contract: null,
  providers: null,
  queue: Promise.resolve(),
  queueDepth: 0,
  startedAt: 0,
});

/** Per-visitor passes. Ephemeral by design: a restart forgets them. */
export interface VisitorPass {
  slug: string;
  secret: Uint8Array;
  nonce: Uint8Array;
  commitment: string | null;
  callsUsed: number;
  quota: number;
}

const sessions = ((globalThis as unknown as { __nightpassSessions?: Map<string, VisitorPass> })
  .__nightpassSessions ??= new Map<string, VisitorPass>());

export const newSessionId = (): string => hex(new Uint8Array(randomBytes(16)));

export function getVisitorPass(sessionId: string): VisitorPass | null {
  return sessions.get(sessionId) ?? null;
}

export function status(): AgentStatus {
  const deployment = readDeployment(NETWORK);
  return {
    phase: process.env.NIGHTPASS_SEED ? runtime.phase : "unconfigured",
    progress: runtime.progress,
    message: process.env.NIGHTPASS_SEED
      ? runtime.message
      : "the demo wallet is not configured on this deployment",
    network: NETWORK,
    contractAddress: deployment?.contractAddress ?? null,
    queueDepth: runtime.queueDepth,
  };
}

/**
 * Starts the wallet if it is not already starting. Returns immediately: callers
 * poll `status()` rather than waiting, because the first sync takes minutes.
 */
export function ensureStarted(): AgentStatus {
  if (!process.env.NIGHTPASS_SEED) return status();
  if (runtime.startedAt === 0) {
    runtime.startedAt = Date.now();
    runtime.phase = "starting";
    runtime.message = "building the wallet";
    void boot().catch((e) => {
      runtime.phase = "error";
      runtime.message = e instanceof Error ? e.message : "could not start the agent";
      console.error("[nightpass] agent boot failed:", e);
    });
  }
  return status();
}

async function boot(): Promise<void> {
  const deployment = readDeployment(NETWORK);
  if (!deployment) throw new Error("no Nightpass deployment recorded for this network");

  const [
    ledgerMod,
    { WalletFacade },
    { DustWallet },
    { HDWallet, Roles },
    { ShieldedWallet },
    unshielded,
    { getNetworkId, setNetworkId },
    { CompiledContract },
    { findDeployedContract },
    { httpClientProofProvider },
    { indexerPublicDataProvider },
    { NodeZkConfigProvider },
    contractPkg,
    Rx,
    wsMod,
  ] = await Promise.all([
    import("@midnight-ntwrk/ledger-v8"),
    import("@midnight-ntwrk/wallet-sdk-facade"),
    import("@midnight-ntwrk/wallet-sdk-dust-wallet"),
    import("@midnight-ntwrk/wallet-sdk-hd"),
    import("@midnight-ntwrk/wallet-sdk-shielded"),
    import("@midnight-ntwrk/wallet-sdk-unshielded-wallet"),
    import("@midnight-ntwrk/midnight-js/network-id"),
    import("@midnight-ntwrk/compact-js"),
    import("@midnight-ntwrk/midnight-js/contracts"),
    import("@midnight-ntwrk/midnight-js-http-client-proof-provider"),
    import("@midnight-ntwrk/midnight-js-indexer-public-data-provider"),
    import("@midnight-ntwrk/midnight-js-node-zk-config-provider"),
    import("@nightpass/contract"),
    import("rxjs"),
    import("ws"),
  ]);

  // Apollo drives wallet sync over GraphQL subscriptions and expects a global.
  (globalThis as unknown as { WebSocket?: unknown }).WebSocket ??= wsMod.WebSocket;

  setNetworkId(NETWORK);
  const ledger = ledgerMod;

  const { Nightpass, witnesses, createNightpassPrivateState } = contractPkg;

  runtime.message = "loading circuit assets";
  const zkConfigProvider = new NodeZkConfigProvider(ZK_CONFIG_PATH);
  const compiled = CompiledContract.make("nightpass", Nightpass.Contract).pipe(
    CompiledContract.withWitnesses(witnesses),
    CompiledContract.withCompiledFileAssets(ZK_CONFIG_PATH),
  );
  // Reading one prover key now turns "the keys did not ship" into a clear
  // failure at boot rather than a confusing one on a visitor's first click.
  await zkConfigProvider.getProverKey("issuePass" as never);

  const seed = process.env.NIGHTPASS_SEED!.trim();
  const hd = HDWallet.fromSeed(Buffer.from(seed, "hex"));
  if (hd.type !== "seedOk") throw new Error("NIGHTPASS_SEED is not a valid 32-byte hex seed");
  const derived = hd.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);
  if (derived.type !== "keysDerived") throw new Error("could not derive wallet keys");
  const keys = derived.keys;
  hd.hdWallet.clear();

  const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
  const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
  const unshieldedKeystore = unshielded.createKeystore(keys[Roles.NightExternal], getNetworkId());

  const conn = { indexerHttpUrl: INDEXER.http, indexerWsUrl: INDEXER.ws };
  const wallet = await WalletFacade.init({
    configuration: {
      networkId: getNetworkId(),
      indexerClientConnection: conn,
      provingServerUrl: new URL(PROOF_SERVER),
      relayURL: new URL(INDEXER.node.replace(/^http/, "ws")),
      txHistoryStorage: new unshielded.InMemoryTransactionHistoryStorage(),
      costParameters: { additionalFeeOverhead: 300_000_000_000_000n, feeBlocksMargin: 5 },
    } as never,
    shielded: (cfg: never) => ShieldedWallet(cfg).startWithSecretKeys(shieldedSecretKeys),
    unshielded: (cfg: never) =>
      unshielded.UnshieldedWallet(cfg).startWithPublicKey(
        unshielded.PublicKey.fromKeyStore(unshieldedKeystore),
      ),
    dust: (cfg: never) =>
      DustWallet(cfg).startWithSecretKey(
        dustSecretKey,
        ledger.LedgerParameters.initialParameters().dust,
      ),
  });
  await wallet.start(shieldedSecretKeys, dustSecretKey);

  runtime.phase = "syncing";
  runtime.message = "syncing with Midnight, this takes a few minutes on a cold start";

  const pct = (a: unknown, b: unknown) => {
    const x = Number(a ?? 0);
    const y = Number(b ?? 0);
    return y > 0 ? Math.min(100, (x / y) * 100) : 0;
  };
  const sub = wallet
    .state()
    .pipe(Rx.throttleTime(4_000))
    .subscribe((s) => {
      const st = s as unknown as Record<string, { progress?: Record<string, unknown> }>;
      const sh = st.shielded?.progress;
      const du = st.dust?.progress;
      const un = st.unshielded?.progress;
      if (!sh && !du && !un) return;
      const parts = [
        pct(sh?.appliedIndex, sh?.highestRelevantWalletIndex),
        pct(du?.appliedIndex, du?.highestRelevantWalletIndex),
        pct(un?.appliedId, un?.highestTransactionId),
      ];
      runtime.progress = Math.floor(parts.reduce((a, b) => a + b, 0) / parts.length);
    });

  await Rx.firstValueFrom(wallet.state().pipe(Rx.filter((s) => (s as unknown as { isSynced: boolean }).isSynced)));
  sub.unsubscribe();
  runtime.progress = 100;

  // NIGHT does not pay fees; DUST does, and only NIGHT that has been registered
  // for it generates any. A funded wallet still cannot transact before this.
  const synced = await Rx.firstValueFrom(
    wallet.state().pipe(Rx.filter((s) => (s as unknown as { isSynced: boolean }).isSynced)),
  );
  const st = synced as unknown as {
    dust: { availableCoins: unknown[] };
    unshielded: { availableCoins: { meta?: { registeredForDustGeneration?: boolean } }[] };
  };
  if (st.dust.availableCoins.length === 0) {
    runtime.message = "registering NIGHT for DUST generation";
    const undesignated = st.unshielded.availableCoins.filter(
      (c) => c.meta?.registeredForDustGeneration !== true,
    );
    if (undesignated.length > 0) {
      const recipe = await wallet.registerNightUtxosForDustGeneration(
        undesignated as never,
        unshieldedKeystore.getPublicKey(),
        (payload: Uint8Array) => unshieldedKeystore.signData(payload),
      );
      await wallet.submitTransaction(await wallet.finalizeRecipe(recipe));
    }
    await Rx.firstValueFrom(
      wallet.state().pipe(
        Rx.filter((s) => (s as unknown as { isSynced: boolean }).isSynced),
        Rx.filter((s) => (s as unknown as { dust: { balance: (d: Date) => bigint } }).dust.balance(new Date()) > 0n),
      ),
    );
  }

  // Bridge the wallet to midnight-js. The manual intent signing works around a
  // wallet SDK bug that hardcodes the 'pre-proof' marker when cloning intents.
  const signIntents = (
    tx: { intents?: Map<number, never> },
    signFn: (p: Uint8Array) => never,
    marker: "proof" | "pre-proof",
  ) => {
    if (!tx.intents || tx.intents.size === 0) return;
    for (const segment of tx.intents.keys()) {
      const intent = tx.intents.get(segment) as never as {
        serialize: () => Uint8Array;
      };
      if (!intent) continue;
      const cloned = ledger.Intent.deserialize(
        "signature",
        marker,
        "pre-binding",
        intent.serialize(),
      ) as never as {
        signatureData: (s: number) => Uint8Array;
        fallibleUnshieldedOffer?: { inputs: unknown[]; signatures: { at: (i: number) => unknown }; addSignatures: (s: unknown[]) => unknown };
        guaranteedUnshieldedOffer?: { inputs: unknown[]; signatures: { at: (i: number) => unknown }; addSignatures: (s: unknown[]) => unknown };
      };
      const signature = signFn(cloned.signatureData(segment));
      for (const which of ["fallibleUnshieldedOffer", "guaranteedUnshieldedOffer"] as const) {
        const offer = cloned[which];
        if (!offer) continue;
        const sigs = offer.inputs.map((_, i) => offer.signatures.at(i) ?? signature);
        (cloned as Record<string, unknown>)[which] = offer.addSignatures(sigs);
      }
      tx.intents.set(segment, cloned as never);
    }
  };

  const walletState = await Rx.firstValueFrom(
    wallet.state().pipe(Rx.filter((s) => (s as unknown as { isSynced: boolean }).isSynced)),
  );
  const ws = walletState as unknown as {
    shielded: { coinPublicKey: { toHexString: () => string }; encryptionPublicKey: { toHexString: () => string } };
  };

  const walletProvider = {
    getCoinPublicKey: () => ws.shielded.coinPublicKey.toHexString(),
    getEncryptionPublicKey: () => ws.shielded.encryptionPublicKey.toHexString(),
    async balanceTx(tx: never, ttl?: Date) {
      const recipe = await wallet.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys, dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );
      const signFn = (p: Uint8Array) => unshieldedKeystore.signData(p) as never;
      signIntents(recipe.baseTransaction as never, signFn, "proof");
      if (recipe.balancingTransaction) {
        signIntents(recipe.balancingTransaction as never, signFn, "pre-proof");
      }
      return wallet.finalizeRecipe(recipe);
    },
    submitTx: (tx: never) => wallet.submitTransaction(tx) as never,
  };

  // In-memory private state: each visitor's secret is written here immediately
  // before their call and never persisted to disk.
  const store = new Map<string, unknown>();
  // The interface scopes every read and write by contract address, so keys are
  // namespaced the same way rather than colliding across contracts.
  let scope = "";
  const privateStateProvider = {
    setContractAddress: (address: string) => {
      scope = address;
    },
    set: async (id: string, s: unknown) => void store.set(`${scope}:${id}`, s),
    get: async (id: string) => store.get(`${scope}:${id}`) ?? null,
    remove: async (id: string) => void store.delete(`${scope}:${id}`),
    clear: async () => void store.clear(),
    setSigningKey: async () => {},
    getSigningKey: async () => null,
    removeSigningKey: async () => {},
    clearSigningKeys: async () => {},
  };

  const providers = {
    privateStateProvider,
    publicDataProvider: indexerPublicDataProvider(INDEXER.http, INDEXER.ws),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(PROOF_SERVER, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };

  await privateStateProvider.set(PRIVATE_STATE_ID, createNightpassPrivateState(new Uint8Array(randomBytes(32))));
  const contract = await findDeployedContract(providers as never, {
    contractAddress: deployment.contractAddress,
    compiledContract: compiled as never,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: createNightpassPrivateState(new Uint8Array(randomBytes(32))) as never,
  });

  runtime.providers = providers;
  runtime.contract = contract;
  runtime.phase = "ready";
  runtime.message = "ready";
}

/** Serialises work: one wallet cannot sign two transactions at once. */
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  runtime.queueDepth += 1;
  const next = runtime.queue.then(fn, fn);
  runtime.queue = next.then(
    () => undefined,
    () => undefined,
  );
  return next.finally(() => {
    runtime.queueDepth -= 1;
  }) as Promise<T>;
}

function requireReady() {
  if (runtime.phase !== "ready" || !runtime.contract) {
    throw new Error(
      runtime.phase === "syncing"
        ? `the demo wallet is still syncing (${runtime.progress ?? 0}%)`
        : `the demo agent is not ready: ${runtime.message}`,
    );
  }
  return {
    contract: runtime.contract as {
      callTx: Record<string, (...a: unknown[]) => Promise<{ public: { txId: string; blockHeight: number }; private: { result: unknown } }>>;
    },
    providers: runtime.providers as {
      privateStateProvider: { set: (id: string, s: unknown) => Promise<void> };
    },
  };
}

const toolIdFor = async (slug: string): Promise<Uint8Array> => {
  const { createHash } = await import("node:crypto");
  return new Uint8Array(createHash("sha256").update(slug).digest());
};

/** Buys a pass for the visitor, with a secret that is theirs alone. */
export async function issuePassFor(
  sessionId: string,
  slug: string,
  quota: number,
): Promise<RunResult> {
  return enqueue(async () => {
    const { contract, providers } = requireReady();
    const { createNightpassPrivateState, withPass } = await import("@nightpass/contract");

    const secret = new Uint8Array(randomBytes(32));
    const nonce = new Uint8Array(randomBytes(32));
    const toolId = await toolIdFor(slug);

    await providers.privateStateProvider.set(
      PRIVATE_STATE_ID,
      withPass(createNightpassPrivateState(secret), toolId, nonce),
    );

    const tx = await contract.callTx.issuePass(toolId);
    const commitment = hex(tx.private.result as Uint8Array);
    sessions.set(sessionId, { slug, secret, nonce, commitment, callsUsed: 0, quota });

    return { txId: tx.public.txId, blockHeight: tx.public.blockHeight, value: commitment };
  });
}

/** Spends one call against the visitor's own pass. */
export async function redeemCallFor(sessionId: string): Promise<RunResult> {
  return enqueue(async () => {
    const { contract, providers } = requireReady();
    const pass = sessions.get(sessionId);
    if (!pass) throw new Error("buy a pass first");
    if (pass.callsUsed >= pass.quota) throw new Error("this pass has no calls left");

    const { createNightpassPrivateState } = await import("@nightpass/contract");
    const toolId = await toolIdFor(pass.slug);

    await providers.privateStateProvider.set(PRIVATE_STATE_ID, {
      ...createNightpassPrivateState(pass.secret),
      passes: { [hex(toolId)]: { nonce: pass.nonce, callsUsed: pass.callsUsed } },
    });

    const tx = await contract.callTx.redeemCall(toolId);
    pass.callsUsed += 1;

    return {
      txId: tx.public.txId,
      blockHeight: tx.public.blockHeight,
      value: hex(tx.private.result as Uint8Array),
    };
  });
}

/** Publishes an attestation the visitor can then verify as the auditor. */
export async function attestFor(sessionId: string, auditor: string): Promise<RunResult> {
  return enqueue(async () => {
    const { contract, providers } = requireReady();
    const pass = sessions.get(sessionId);
    if (!pass) throw new Error("buy a pass first");
    if (pass.callsUsed === 0) throw new Error("spend at least one call before attesting");

    const { createNightpassPrivateState, createHash } = {
      ...(await import("@nightpass/contract")),
      createHash: (await import("node:crypto")).createHash,
    };
    const toolId = await toolIdFor(pass.slug);
    const auditorId = new Uint8Array(createHash("sha256").update(auditor).digest());

    await providers.privateStateProvider.set(PRIVATE_STATE_ID, {
      ...createNightpassPrivateState(pass.secret),
      passes: { [hex(toolId)]: { nonce: pass.nonce, callsUsed: pass.callsUsed } },
    });

    const tx = await contract.callTx.attestUsage(toolId, auditorId, BigInt(pass.callsUsed));
    return {
      txId: tx.public.txId,
      blockHeight: tx.public.blockHeight,
      value: hex(tx.private.result as Uint8Array),
    };
  });
}

/** The visitor's own secret, handed back so they can audit their own calls. */
export function revealSecretFor(sessionId: string): { secretHex: string; nonceHex: string; slug: string; calls: number } | null {
  const p = sessions.get(sessionId);
  return p ? { secretHex: hex(p.secret), nonceHex: hex(p.nonce), slug: p.slug, calls: p.callsUsed } : null;
}
