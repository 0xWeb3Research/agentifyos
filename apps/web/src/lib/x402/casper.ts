// Real Casper testnet integration, no mocks. Signs the x402 EIP-712 payment
// authorization, verifies it, and settles it on-chain by calling the WCSPR
// contract's `transfer_with_authorization` entry point. Server-only.
//
// APIs verified live against casper-js-sdk@5.0.12 + @casper-ecosystem/casper-eip-712@1.2.1
// (see scripts/casper-probe.ts, scripts/casper/sign-test.ts).
import { readFileSync } from "node:fs";
import path from "node:path";
import { webcrypto } from "node:crypto";
import * as CasperNS from "casper-js-sdk";
import * as Eip712NS from "@casper-ecosystem/casper-eip-712";

// casper-js-sdk 5.x ships CJS; unwrap the interop default in both tsx and Next.
const C: any = (CasperNS as any).default ?? CasperNS;
const eip: any = (Eip712NS as any).default ?? Eip712NS;
const {
  PrivateKey, PublicKey, KeyAlgorithm, Key, CLValue, CLTypeUInt8, Args,
  ContractCallBuilder, SessionBuilder,
} = C;

export const TESTNET = {
  network: "casper:casper-test",
  chainName: "casper-test",
  rpcUrl: process.env.CSPR_NODE_RPC || "https://node.testnet.casper.network/rpc",
  explorerBase: "https://testnet.cspr.live",
} as const;

export function keyAlgo(name = "ed25519"): number {
  return name.toLowerCase() === "secp256k1" ? KeyAlgorithm.SECP256K1 : KeyAlgorithm.ED25519;
}

export interface CasperWallet {
  privateKey: any;
  publicKey: any;
  publicKeyHex: string; // "01…" alg-prefixed
  accountHash: string; // 64-hex, no prefix
  address: string; // "00" + accountHash (x402 wire form)
  algo: number;
}

// PrivateKey.fromPem is synchronous in casper-js-sdk 5.x.
export function loadWallet(pem: string, algo = KeyAlgorithm.ED25519): CasperWallet {
  const privateKey = PrivateKey.fromPem(pem, algo);
  const publicKey = privateKey.publicKey;
  const accountHash = publicKey.accountHash().toHex();
  return {
    privateKey,
    publicKey,
    publicKeyHex: publicKey.toHex(),
    accountHash,
    address: "00" + accountHash,
    algo,
  };
}

export function loadWalletFromFile(pemPath: string, algo = KeyAlgorithm.ED25519): CasperWallet {
  return loadWallet(readFileSync(pemPath, "utf8"), algo);
}

/**
 * Load a role key from the environment first, then from disk.
 *
 * Hosted deploys (Railway, Vercel) can't ship PEM files, so the key is supplied
 * inline via e.g. FACILITATOR_KEY_PEM_CONTENT. Locally we keep using
 * keys/<role>.pem, which stays gitignored.
 */
export function loadRoleWallet(
  role: "facilitator" | "agent" | "treasury",
  algo = KeyAlgorithm.ED25519,
): CasperWallet {
  const upper = role.toUpperCase();
  const inline = process.env[`${upper}_KEY_PEM_CONTENT`];
  if (inline && inline.includes("BEGIN")) {
    // Railway-style env vars often arrive with literal \n escapes.
    return loadWallet(inline.replace(/\\n/g, "\n"), algo);
  }
  const fromEnv = process.env[`${upper}_KEY_PEM`];
  const pemPath = fromEnv
    ? path.resolve(process.cwd(), fromEnv)
    : path.join(process.cwd(), "keys", `${role}.pem`);
  return loadWalletFromFile(pemPath, algo);
}

// ── x402 wire types (official ExactCasper shape) ────────────────────────────
export interface ExactCasperAuthorization {
  from: string; // "00"+hash
  to: string; // "00"+hash
  value: string; // atomic decimal
  validAfter: string;
  validBefore: string;
  nonce: string; // 32-byte hex
}
export interface ExactCasperPayload {
  signature: string; // 65-byte hex
  publicKey: string;
  authorization: ExactCasperAuthorization;
}
export interface CasperPaymentRequirements {
  scheme: "exact";
  network: string;
  amount: string;
  asset: string; // 64-hex package hash
  payTo: string; // "00"+hash
  maxTimeoutSeconds: number;
  extra: { name: string; version: string; symbol?: string; decimals?: string };
}

const TW_AUTH_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
};

function hex(u: Uint8Array): string {
  return Buffer.from(u).toString("hex");
}

function digestFor(auth: ExactCasperAuthorization, req: CasperPaymentRequirements): Uint8Array {
  const domain = eip.buildDomain(req.extra.name, req.extra.version, req.network, "0x" + req.asset);
  const message = {
    from: "0x" + auth.from,
    to: "0x" + auth.to,
    value: BigInt(auth.value),
    validAfter: BigInt(auth.validAfter),
    validBefore: BigInt(auth.validBefore),
    nonce: "0x" + auth.nonce,
  };
  try {
    return eip.hashTypedData(domain, TW_AUTH_TYPES, "TransferWithAuthorization", message, {
      domainTypes: eip.CASPER_DOMAIN_TYPES,
    });
  } catch {
    return eip.hashTypedData(domain, TW_AUTH_TYPES, "TransferWithAuthorization", message);
  }
}

// Agent side: build + sign a real EIP-712 payment authorization.
export function signPayment(
  wallet: CasperWallet,
  req: CasperPaymentRequirements,
  nowSec = Math.floor(Date.now() / 1000),
): ExactCasperPayload {
  const auth: ExactCasperAuthorization = {
    from: wallet.address,
    to: req.payTo,
    value: req.amount,
    validAfter: String(nowSec - 600),
    validBefore: String(nowSec + req.maxTimeoutSeconds),
    nonce: hex(webcrypto.getRandomValues(new Uint8Array(32))),
  };
  const digest = digestFor(auth, req);
  const signature = wallet.privateKey.signAndAddAlgorithmBytes(digest); // 65 bytes
  return { signature: hex(signature), publicKey: wallet.publicKeyHex, authorization: auth };
}

export interface VerifyResult {
  valid: boolean;
  payer: string;
  reason?: string;
}

// Facilitator side (off-chain checks): mirrors the reference facilitator's verify.
export function verifyPayment(payload: ExactCasperPayload, req: CasperPaymentRequirements): VerifyResult {
  // The payload arrives base64-decoded from an unauthenticated header. Validate
  // the shape before touching it so garbage can't throw (and 500) downstream.
  const a = payload?.authorization;
  if (
    !payload || typeof payload !== "object" ||
    typeof payload.signature !== "string" ||
    typeof payload.publicKey !== "string" ||
    !a || typeof a !== "object" ||
    [a.from, a.to, a.value, a.validAfter, a.validBefore, a.nonce].some((v) => typeof v !== "string")
  ) {
    return { valid: false, payer: "", reason: "malformed_payload" };
  }
  const payer = a.from;
  if (a.to !== req.payTo) return { valid: false, payer, reason: "pay_to_mismatch" };
  if (a.value !== req.amount) return { valid: false, payer, reason: "amount_mismatch" };
  // value/validAfter/validBefore are fed to BigInt() inside digestFor. A field
  // like validAfter:"abc" is a string (so it passes the typeof check above) but
  // makes BigInt() throw a SyntaxError there — which is outside the try/catch
  // below and escaped as an unauthenticated 500. Require decimal digits up
  // front, and compare the time window with BigInt: Number("abc") is NaN, and
  // every NaN comparison is false, so the Number-based window checks silently
  // passed malformed input straight through to the throw.
  const DIGITS = /^\d+$/;
  if (!DIGITS.test(a.value) || !DIGITS.test(a.validAfter) || !DIGITS.test(a.validBefore)) {
    return { valid: false, payer, reason: "malformed_payload" };
  }
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (BigInt(a.validAfter) > now) return { valid: false, payer, reason: "not_yet_valid" };
  if (now > BigInt(a.validBefore) - 6n) return { valid: false, payer, reason: "expired" };
  // public key must parse and derive to the payer account hash
  let pub: any;
  try {
    pub = PublicKey.fromHex(payload.publicKey);
  } catch {
    return { valid: false, payer, reason: "bad_public_key" };
  }
  if (pub.accountHash().toHex() !== payer.slice(2)) return { valid: false, payer, reason: "public_key_mismatch" };
  let digest: Uint8Array;
  try {
    digest = digestFor(a, req);
  } catch {
    return { valid: false, payer, reason: "malformed_payload" };
  }
  const sig = Buffer.from(payload.signature, "hex");
  try {
    if (pub.verifySignature(digest, sig) !== true) return { valid: false, payer, reason: "invalid_signature" };
  } catch {
    return { valid: false, payer, reason: "invalid_signature" }; // verifySignature throws on bad sig
  }
  return { valid: true, payer };
}

// ── on-chain settlement ──────────────────────────────────────────────────────
// Measured on testnet: transfer_with_authorization consumes ~2.71 CSPR. The
// reference facilitator declares 7, but overpayment burns 25% of the remainder;
// 4 CSPR also keeps us in the cheaper "wasm small" lane (5 CSPR cap, 40 txs
// per block vs 2). Override with FACILITATOR_GAS_MOTES.
const DEFAULT_PAYMENT_MOTES = Number(process.env.FACILITATOR_GAS_MOTES || 4_000_000_000);

// Submit + await via raw JSON-RPC rather than the SDK's HttpHandler. Inside the
// Next.js runtime the SDK's HTTP layer fails transaction POSTs with a spurious
// 413 (the body is only ~1.6 KB); plain fetch works everywhere, so we use it.
export async function putTransactionRaw(tx: any, rpcUrl = TESTNET.rpcUrl): Promise<string> {
  const out = await jsonRpc("account_put_transaction", { transaction: { Version1: tx.toJSON() } }, rpcUrl);
  if (out?.error) throw new Error(`${out.error.code}: ${out.error.message}`);
  const h = out?.result?.transaction_hash;
  return h?.Version1 ?? h?.Deploy ?? String(h ?? "");
}

export async function waitForTransactionRaw(
  hash: string,
  timeoutMs = 90_000,
  rpcUrl = TESTNET.rpcUrl,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const out = await jsonRpc(
      "info_get_transaction",
      { transaction_hash: { Version1: hash }, finalized_approvals: true },
      rpcUrl,
    );
    const info = out?.result?.execution_info;
    const result = info?.execution_result;
    if (info?.block_height != null && result) {
      const err =
        result?.Version2?.error_message ?? result?.Version1?.error_message ?? result?.error_message;
      if (err) throw new Error(`transaction reverted: ${err}`);
      return;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`timed out waiting for transaction ${hash}`);
}

function twAuthArgs(p: ExactCasperPayload) {
  const nonceBytes = Buffer.from(p.authorization.nonce, "hex");
  const sigBytes = Buffer.from(p.signature, "hex");
  return Args.fromMap({
    from: CLValue.newCLKey(Key.newKey("account-hash-" + p.authorization.from.slice(2))),
    to: CLValue.newCLKey(Key.newKey("account-hash-" + p.authorization.to.slice(2))),
    // WCSPR v8 renamed this arg from `amount` to `value`, matching EIP-3009's
    // canonical struct. v7 is disabled on testnet, so `amount` now reverts with
    // "User error: 64658". The signed digest is unaffected: the typed-data
    // field was already `value`.
    value: CLValue.newCLUInt256(p.authorization.value),
    valid_after: CLValue.newCLUint64(parseInt(p.authorization.validAfter, 10)),
    valid_before: CLValue.newCLUint64(parseInt(p.authorization.validBefore, 10)),
    nonce: CLValue.newCLList(CLTypeUInt8, Array.from(nonceBytes).map((b) => CLValue.newCLUint8(b))),
    public_key: CLValue.newCLPublicKey(PublicKey.fromHex(p.publicKey)),
    signature: CLValue.newCLList(CLTypeUInt8, Array.from(sigBytes).map((b) => CLValue.newCLUint8(b))),
  });
}

// Exported so the settle transaction can be inspected/diagnosed independently.
export function buildSettleTx(
  facilitator: CasperWallet,
  payload: ExactCasperPayload,
  req: CasperPaymentRequirements,
  paymentMotes = DEFAULT_PAYMENT_MOTES,
) {
  return new ContractCallBuilder()
    .from(facilitator.publicKey)
    .byPackageHash(req.asset)
    .entryPoint("transfer_with_authorization")
    .runtimeArgs(twAuthArgs(payload))
    .chainName(TESTNET.chainName)
    .payment(paymentMotes)
    .build();
}

export interface SettleResult {
  success: boolean;
  // "settled": confirmed on-chain. "pending": accepted by the node but our poll
  // window elapsed before confirmation — the transfer MAY still execute and move
  // the payer's WCSPR, so callers must record it (with the txHash) and must
  // NOT re-charge or re-submit. "failed": rejected before or during submission,
  // no funds moved. `success` stays false for both pending and failed so old
  // call sites fail closed; new call sites branch on `status`.
  status: "settled" | "pending" | "failed";
  txHash: string;
  explorerUrl: string;
  network: string;
  payer: string;
  reason?: string;
}

// Facilitator submits the signed authorization on-chain and pays gas.
export async function settleOnChain(
  facilitator: CasperWallet,
  payload: ExactCasperPayload,
  req: CasperPaymentRequirements,
  paymentMotes = DEFAULT_PAYMENT_MOTES,
): Promise<SettleResult> {
  const pre = verifyPayment(payload, req);
  const payer = payload.authorization.from;
  if (!pre.valid) return { success: false, status: "failed", txHash: "", explorerUrl: "", network: req.network, payer, reason: pre.reason };

  // The facilitator pays gas. An unfunded account has no on-chain entity, so the
  // node rejects its transactions with a generic -32016; check first and say why.
  const gasBalance = BigInt(await getCsprBalance(facilitator.publicKeyHex));
  if (gasBalance < BigInt(paymentMotes)) {
    return {
      success: false,
      status: "failed",
      txHash: "",
      explorerUrl: "",
      network: req.network,
      payer,
      reason:
        `facilitator unfunded (${(Number(gasBalance) / 1e9).toFixed(2)} CSPR, needs ` +
        `~${(Number(paymentMotes) / 1e9).toFixed(0)}). Fund ${facilitator.publicKeyHex} ` +
        `at https://testnet.cspr.live/tools/faucet (see docs/TESTNET.md §2)`,
    };
  }

  const tx = buildSettleTx(facilitator, payload, req, paymentMotes);
  tx.sign(facilitator.privateKey);

  // Submission fails if the facilitator has no CSPR for gas; report it cleanly
  // rather than throwing, so callers can surface "fund the facilitator".
  let txHash: string;
  try {
    txHash = await putTransactionRaw(tx);
  } catch (e) {
    const msg = (e as Error).message;
    const unfunded = /insufficient|balance|purse|funds/i.test(msg);
    return {
      success: false,
      status: "failed",
      txHash: "",
      explorerUrl: "",
      network: req.network,
      payer,
      reason: unfunded
        ? `facilitator unfunded: send CSPR to ${facilitator.publicKeyHex} (see docs/TESTNET.md §2)`
        : `submit failed: ${msg}`,
    };
  }

  try {
    await waitForTransactionRaw(txHash, 90_000);
  } catch (e) {
    const msg = (e as Error).message;
    const explorerUrl = `${TESTNET.explorerBase}/deploy/${txHash}`;
    // A timeout is NOT a clean failure: the tx was accepted by the node and may
    // still execute after our polling window, moving the payer's WCSPR. Report
    // it as pending (never success) with the hash so callers surface "pending ·
    // verify on the explorer" instead of "failed", and don't re-charge.
    const timedOut = /timed out waiting/i.test(msg);
    return {
      success: false,
      status: timedOut ? "pending" : "failed",
      txHash,
      explorerUrl,
      network: req.network,
      payer,
      reason: timedOut
        ? `pending_onchain: tx may still settle, verify at ${explorerUrl}`
        : msg,
    };
  }
  return {
    success: true,
    status: "settled",
    txHash,
    explorerUrl: `${TESTNET.explorerBase}/deploy/${txHash}`,
    network: req.network,
    payer,
  };
}

// Distribute WCSPR from a treasury to an agent (standard CEP-18 transfer).
export async function transferWcspr(
  from: CasperWallet,
  toAccountHashHex: string,
  amount: string,
  packageHash: string,
  paymentMotes = 3_000_000_000,
): Promise<string> {
  const tx = new ContractCallBuilder()
    .from(from.publicKey)
    .byPackageHash(packageHash)
    .entryPoint("transfer")
    .runtimeArgs(
      Args.fromMap({
        recipient: CLValue.newCLKey(Key.newKey("account-hash-" + toAccountHashHex.replace(/^00/, ""))),
        amount: CLValue.newCLUInt256(amount),
      }),
    )
    .chainName(TESTNET.chainName)
    .payment(paymentMotes)
    .build();
  tx.sign(from.privateKey);
  const hash = await putTransactionRaw(tx);
  await waitForTransactionRaw(hash, 90_000);
  return hash;
}

// ── wrap CSPR → WCSPR (Odra payable `deposit`) ───────────────────────────────
// Casper 2.0 has NO transferred-value primitive for stored-contract calls, so a
// ContractCallBuilder call would mint 0. Odra payable entry points read an
// undeclared `cargo_purse` arg, which is injected by Odra's proxy_caller session
// wasm. So wrapping is a SESSION transaction, not a contract call.
export function buildWrapTx(
  wallet: CasperWallet,
  amountMotes: string,
  packageHash: string,
  proxyWasm: Uint8Array,
  gasMotes = 20_000_000_000,
) {
  // `deposit` declares no args of its own → empty RuntimeArgs, serialized.
  const innerBytes: Uint8Array = Args.fromMap({}).toBytes();
  // Casper `Bytes` == length-prefixed List<U8>. newCLByteArray would omit the
  // length prefix and fail Bytes::from_bytes inside the proxy caller.
  const argsBytes = CLValue.newCLList(
    CLTypeUInt8,
    Array.from(innerBytes).map((b) => CLValue.newCLUint8(b)),
  );
  const sessionArgs = Args.fromMap({
    package_hash: CLValue.newCLByteArray(Buffer.from(packageHash, "hex")), // PACKAGE hash (32 bytes)
    entry_point: CLValue.newCLString("deposit"),
    args: argsBytes,
    attached_value: CLValue.newCLUInt512(amountMotes), // the CSPR actually wrapped
    amount: CLValue.newCLUInt512(amountMotes), // grants main-purse access
  });
  return new SessionBuilder()
    .from(wallet.publicKey)
    .wasm(proxyWasm)
    .runtimeArgs(sessionArgs)
    .chainName(TESTNET.chainName)
    .payment(gasMotes) // GAS: separate from the wrapped amount
    .build();
}

// WCSPR is minted to get_caller(), i.e. the signing account.
export async function wrapCspr(
  wallet: CasperWallet,
  amountMotes: string,
  packageHash: string,
  proxyWasm: Uint8Array,
  gasMotes = 20_000_000_000,
): Promise<string> {
  const tx = buildWrapTx(wallet, amountMotes, packageHash, proxyWasm, gasMotes);
  tx.sign(wallet.privateKey);
  const hash = await putTransactionRaw(tx);
  await waitForTransactionRaw(hash, 120_000);
  return hash;
}

// ── WCSPR balance (dictionary read) ──────────────────────────────────────────
// `balance_of` returns U256 but CANNOT be called read-only over RPC (no eth_call
// equivalent; speculative_exec is unavailable on the public node). Balances live
// in the contract's `balances` dictionary. Item key = base64(0x00 || accountHash),
// i.e. the serialized Key::Account. Verified live against real holders.
const WCSPR_BALANCES_SEED_UREF =
  process.env.WCSPR_BALANCES_UREF ||
  "uref-f8491246e0eed9c5cd5c0a896dc6e0a270bba846df69b6d497c9694dcdc2770c-007";

async function jsonRpc(method: string, params: unknown, rpcUrl = TESTNET.rpcUrl): Promise<any> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  return res.json();
}

export function wcsprDictItemKey(accountHash: string): string {
  const bare = accountHash.length === 66 && accountHash.startsWith("00")
    ? accountHash.slice(2)
    : accountHash;
  return Buffer.concat([Buffer.from([0x00]), Buffer.from(bare, "hex")]).toString("base64");
}

// Returns atomic WCSPR (9 decimals). Unfunded/never-held accounts are absent from
// the dictionary (-32003); that means 0, not an error.
export async function getWcsprBalance(accountHash: string, rpcUrl = TESTNET.rpcUrl): Promise<string> {
  const root = await jsonRpc("chain_get_state_root_hash", {}, rpcUrl);
  const stateRootHash = root?.result?.state_root_hash;
  if (!stateRootHash) throw new Error("could not read state root hash");
  const out = await jsonRpc(
    "state_get_dictionary_item",
    {
      state_root_hash: stateRootHash,
      dictionary_identifier: {
        URef: {
          seed_uref: WCSPR_BALANCES_SEED_UREF,
          dictionary_item_key: wcsprDictItemKey(accountHash),
        },
      },
    },
    rpcUrl,
  );
  if (out?.error) {
    if (out.error.code === -32003) return "0"; // not in dictionary => zero balance
    throw new Error(`${out.error.code}: ${out.error.message}`);
  }
  return out?.result?.stored_value?.CLValue?.parsed ?? "0";
}

// Native CSPR balance (motes) for a public key. An unfunded account has no purse
// yet; the node returns error -32026 ("Purse not found"), which we report as 0.
export async function getCsprBalance(publicKeyHex: string, rpcUrl = TESTNET.rpcUrl): Promise<string> {
  const accountHash = PublicKey.fromHex(publicKeyHex).accountHash().toHex();
  const out = await jsonRpc(
    "query_balance",
    { purse_identifier: { main_purse_under_account_hash: `account-hash-${accountHash}` } },
    rpcUrl,
  );
  if (out?.error) {
    // -32026 "Purse not found" simply means the account is unfunded.
    if (out.error.code === -32026) return "0";
    throw new Error(`${out.error.code}: ${out.error.message}`);
  }
  return out?.result?.balance ?? "0";
}
