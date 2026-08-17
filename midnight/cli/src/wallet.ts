/*
 * Wallet bootstrap for a headless agent.
 *
 * Deliberately no browser extension. An autonomous agent does not click
 * "approve" in a popup, so the whole flow runs from a seed in Node: derive
 * keys, sync, register NIGHT for dust generation, sign and submit.
 *
 * The intent-signing workaround below is carried over from the upstream
 * example-counter CLI, where it is documented as a wallet SDK bug.
 */

import * as ledger from '@midnight-ntwrk/ledger-v8';
import { unshieldedToken } from '@midnight-ntwrk/ledger-v8';
import type { MidnightProvider, WalletProvider } from '@midnight-ntwrk/midnight-js/types';
import { getNetworkId } from '@midnight-ntwrk/midnight-js/network-id';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { HDWallet, Roles, generateRandomSeed } from '@midnight-ntwrk/wallet-sdk-hd';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import {
  createKeystore,
  InMemoryTransactionHistoryStorage,
  PublicKey,
  UnshieldedWallet,
  type UnshieldedKeystore,
} from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import {
  MidnightBech32m,
  ShieldedAddress,
  ShieldedCoinPublicKey,
  ShieldedEncryptionPublicKey,
} from '@midnight-ntwrk/wallet-sdk-address-format';
import { Buffer } from 'buffer';
import * as Rx from 'rxjs';
import { WebSocket } from 'ws';
import type { Config } from './config.ts';
import { note, rule, step, withStatus } from './ui.ts';

// Apollo drives wallet sync over GraphQL subscriptions, which expects a global.
// @ts-expect-error: Node has no global WebSocket that apollo will pick up.
globalThis.WebSocket = WebSocket;

export interface WalletContext {
  wallet: WalletFacade;
  shieldedSecretKeys: ledger.ZswapSecretKeys;
  dustSecretKey: ledger.DustSecretKey;
  unshieldedKeystore: UnshieldedKeystore;
  address: string;
}

export const randomSeed = (): string => Buffer.from(generateRandomSeed()).toString('hex');

const deriveKeysFromSeed = (seed: string) => {
  const hdWallet = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
  if (hdWallet.type !== 'seedOk') {
    throw new Error('could not initialise an HD wallet from that seed');
  }
  const derived = hdWallet.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);
  if (derived.type !== 'keysDerived') {
    throw new Error('could not derive keys from that seed');
  }
  hdWallet.hdWallet.clear();
  return derived.keys;
};

const buildShieldedConfig = ({ indexer, indexerWS, node, proofServer }: Config) => ({
  networkId: getNetworkId(),
  indexerClientConnection: { indexerHttpUrl: indexer, indexerWsUrl: indexerWS },
  provingServerUrl: new URL(proofServer),
  relayURL: new URL(node.replace(/^http/, 'ws')),
});

const buildUnshieldedConfig = ({ indexer, indexerWS }: Config) => ({
  networkId: getNetworkId(),
  indexerClientConnection: { indexerHttpUrl: indexer, indexerWsUrl: indexerWS },
  txHistoryStorage: new InMemoryTransactionHistoryStorage(),
});

const buildDustConfig = ({ indexer, indexerWS, node, proofServer }: Config) => ({
  networkId: getNetworkId(),
  costParameters: { additionalFeeOverhead: 300_000_000_000_000n, feeBlocksMargin: 5 },
  indexerClientConnection: { indexerHttpUrl: indexer, indexerWsUrl: indexerWS },
  provingServerUrl: new URL(proofServer),
  relayURL: new URL(node.replace(/^http/, 'ws')),
});

/**
 * Sign every unshielded offer in a transaction's intents with the right proof
 * marker. The SDK's own `signRecipe` hardcodes 'pre-proof', which fails on
 * already-proven intents, so the cloning is done by hand here.
 */
const signTransactionIntents = (
  tx: { intents?: Map<number, any> },
  signFn: (payload: Uint8Array) => ledger.Signature,
  proofMarker: 'proof' | 'pre-proof',
): void => {
  if (!tx.intents || tx.intents.size === 0) return;

  for (const segment of tx.intents.keys()) {
    const intent = tx.intents.get(segment);
    if (!intent) continue;

    const cloned = ledger.Intent.deserialize<
      ledger.SignatureEnabled,
      ledger.Proofish,
      ledger.PreBinding
    >('signature', proofMarker, 'pre-binding', intent.serialize());

    const signature = signFn(cloned.signatureData(segment));

    if (cloned.fallibleUnshieldedOffer) {
      const sigs = cloned.fallibleUnshieldedOffer.inputs.map(
        (_: ledger.UtxoSpend, i: number) =>
          cloned.fallibleUnshieldedOffer!.signatures.at(i) ?? signature,
      );
      cloned.fallibleUnshieldedOffer = cloned.fallibleUnshieldedOffer.addSignatures(sigs);
    }
    if (cloned.guaranteedUnshieldedOffer) {
      const sigs = cloned.guaranteedUnshieldedOffer.inputs.map(
        (_: ledger.UtxoSpend, i: number) =>
          cloned.guaranteedUnshieldedOffer!.signatures.at(i) ?? signature,
      );
      cloned.guaranteedUnshieldedOffer = cloned.guaranteedUnshieldedOffer.addSignatures(sigs);
    }
    tx.intents.set(segment, cloned);
  }
};

export const createWalletAndMidnightProvider = async (
  ctx: WalletContext,
): Promise<WalletProvider & MidnightProvider> => {
  const state = await Rx.firstValueFrom(ctx.wallet.state().pipe(Rx.filter((s) => s.isSynced)));
  return {
    getCoinPublicKey: () => state.shielded.coinPublicKey.toHexString(),
    getEncryptionPublicKey: () => state.shielded.encryptionPublicKey.toHexString(),
    async balanceTx(tx, ttl?) {
      const recipe = await ctx.wallet.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys: ctx.shieldedSecretKeys, dustSecretKey: ctx.dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );
      const signFn = (payload: Uint8Array) => ctx.unshieldedKeystore.signData(payload);
      signTransactionIntents(recipe.baseTransaction, signFn, 'proof');
      if (recipe.balancingTransaction) {
        signTransactionIntents(recipe.balancingTransaction, signFn, 'pre-proof');
      }
      return ctx.wallet.finalizeRecipe(recipe);
    },
    submitTx: (tx) => ctx.wallet.submitTransaction(tx) as any,
  };
};

/*
 * Filter before throttling, not after.
 *
 * The upstream example throttles first, which can swallow the one emission
 * where `isSynced` flips true and then wait forever for another. Throttling is
 * only wanted for the progress line, so it is applied to the reporting path
 * and kept out of the path that decides when we are done.
 */
/*
 * A first sync walks the whole Zswap and DUST index, which on Preview is
 * ~110k entries and takes minutes. Without a progress line that is
 * indistinguishable from a hang, so the three sub-wallets report separately.
 * The unshielded wallet reaches its head long before the other two.
 */
const reportSyncProgress = (wallet: WalletFacade) =>
  wallet
    .state()
    .pipe(Rx.throttleTime(15_000))
    .subscribe((s: any) => {
      const pct = (applied: unknown, total: unknown) => {
        const a = Number(applied ?? 0);
        const t = Number(total ?? 0);
        return t > 0 ? `${Math.min(100, Math.floor((a / t) * 100))}%` : '--';
      };
      const sh = s?.shielded?.progress;
      const du = s?.dust?.progress;
      const un = s?.unshielded?.progress;
      if (!sh && !du && !un) return;
      note(
        `    shielded ${pct(sh?.appliedIndex, sh?.highestRelevantWalletIndex)}` +
          `   dust ${pct(du?.appliedIndex, du?.highestRelevantWalletIndex)}` +
          `   unshielded ${pct(un?.appliedId, un?.highestTransactionId)}`,
      );
    });

const waitForSync = (wallet: WalletFacade) =>
  Rx.firstValueFrom(wallet.state().pipe(Rx.filter((s) => s.isSynced)));

const waitForFunds = (wallet: WalletFacade): Promise<bigint> =>
  Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.filter((s) => s.isSynced),
      Rx.map((s) => s.unshielded.balances[unshieldedToken().raw] ?? 0n),
      Rx.filter((b) => b > 0n),
    ),
  );

/**
 * NIGHT does not pay fees; DUST does, and DUST is generated by NIGHT UTXOs that
 * have been explicitly designated for it. Without this step a funded wallet
 * still cannot afford a single transaction.
 */
const registerForDustGeneration = async (
  wallet: WalletFacade,
  unshieldedKeystore: UnshieldedKeystore,
): Promise<void> => {
  const state = await Rx.firstValueFrom(wallet.state().pipe(Rx.filter((s) => s.isSynced)));

  const waitForDust = () =>
    Rx.firstValueFrom(
      wallet.state().pipe(
        Rx.throttleTime(5_000),
        Rx.filter((s) => s.isSynced),
        Rx.filter((s) => s.dust.balance(new Date()) > 0n),
      ),
    );

  if (state.dust.availableCoins.length > 0) {
    note(`DUST already available: ${state.dust.balance(new Date()).toLocaleString()}`);
    return;
  }

  const undesignated = state.unshielded.availableCoins.filter(
    (coin: any) => coin.meta?.registeredForDustGeneration !== true,
  );

  if (undesignated.length > 0) {
    await withStatus(`Registering ${undesignated.length} NIGHT UTXO(s) for DUST generation`, async () => {
      const recipe = await wallet.registerNightUtxosForDustGeneration(
        undesignated,
        unshieldedKeystore.getPublicKey(),
        (payload) => unshieldedKeystore.signData(payload),
      );
      await wallet.submitTransaction(await wallet.finalizeRecipe(recipe));
    });
  }

  await withStatus('Waiting for DUST to generate', waitForDust);
};

export const buildWallet = async (config: Config, seed: string): Promise<WalletContext> => {
  const ctx = await withStatus('Building wallet from seed', async () => {
    const keys = deriveKeysFromSeed(seed);
    const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
    const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
    const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], getNetworkId());

    const walletConfig = {
      ...buildShieldedConfig(config),
      ...buildUnshieldedConfig(config),
      ...buildDustConfig(config),
    };
    const wallet = await WalletFacade.init({
      configuration: walletConfig,
      shielded: (cfg) => ShieldedWallet(cfg).startWithSecretKeys(shieldedSecretKeys),
      unshielded: (cfg) => UnshieldedWallet(cfg).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore)),
      dust: (cfg) =>
        DustWallet(cfg).startWithSecretKey(dustSecretKey, ledger.LedgerParameters.initialParameters().dust),
    });
    await wallet.start(shieldedSecretKeys, dustSecretKey);

    return {
      wallet,
      shieldedSecretKeys,
      dustSecretKey,
      unshieldedKeystore,
      address: unshieldedKeystore.getBech32Address().toString(),
    };
  });

  // Printed before syncing, which can take minutes. The address is derived from
  // the seed alone, so it is already final and can be funded in parallel.
  rule();
  note(`network      ${config.name}`);
  note(`unshielded   ${ctx.address}`);
  note(`faucet       ${config.faucet}`);
  rule();

  const progress = reportSyncProgress(ctx.wallet);
  const synced = await withStatus(`Syncing with ${config.name}`, () => waitForSync(ctx.wallet));
  progress.unsubscribe();
  const balance = synced.unshielded.balances[unshieldedToken().raw] ?? 0n;

  const coinPubKey = ShieldedCoinPublicKey.fromHexString(synced.shielded.coinPublicKey.toHexString());
  const encPubKey = ShieldedEncryptionPublicKey.fromHexString(
    synced.shielded.encryptionPublicKey.toHexString(),
  );
  note(`shielded     ${MidnightBech32m.encode(getNetworkId(), new ShieldedAddress(coinPubKey, encPubKey)).toString()}`);
  note(`balance      ${balance.toLocaleString()} tNIGHT`);

  if (balance === 0n) {
    step('This wallet holds no tNIGHT, so it cannot pay for a transaction yet.');
    note(`Fund it here:  ${config.faucet}`);
    note(`Paste this:    ${ctx.address}`);
    const funded = await withStatus('Waiting for the faucet payout to land', () => waitForFunds(ctx.wallet));
    note(`balance      ${funded.toLocaleString()} tNIGHT`);
  }

  await registerForDustGeneration(ctx.wallet, ctx.unshieldedKeystore);
  return ctx;
};
