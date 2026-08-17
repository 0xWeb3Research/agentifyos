/*
 * Nightpass operations against a real Midnight network.
 *
 * Everything here goes through the proof server: each call below produces a
 * genuine zero-knowledge proof and a transaction that the network verifies.
 */

import { createHash, randomBytes } from 'node:crypto';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js/contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import {
  Nightpass,
  type NightpassPrivateState,
  createNightpassPrivateState,
  withCallSpent,
  withPass,
  witnesses,
} from '@nightpass/contract';
import { type Config, contractConfig } from './config.ts';
import {
  NightpassPrivateStateId,
  type DeployedNightpassContract,
  type NightpassCircuits,
  type NightpassProviders,
} from './common-types.ts';
import { createWalletAndMidnightProvider, type WalletContext } from './wallet.ts';

/** A tool id is just the marketplace slug, hashed to a fixed width. */
export const toolIdFor = (slug: string): Uint8Array =>
  new Uint8Array(createHash('sha256').update(slug).digest());

export const auditorIdFor = (name: string): Uint8Array =>
  new Uint8Array(createHash('sha256').update(name).digest());

export const freshSecret = (): Uint8Array => new Uint8Array(randomBytes(32));

const compiled = CompiledContract.make<Nightpass.Contract<NightpassPrivateState>>(
  'nightpass',
  Nightpass.Contract<NightpassPrivateState>,
).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets(contractConfig.zkConfigPath),
);

export const configureProviders = async (
  ctx: WalletContext,
  config: Config,
): Promise<NightpassProviders> => {
  const walletAndMidnightProvider = await createWalletAndMidnightProvider(ctx);
  const zkConfigProvider = new NodeZkConfigProvider<NightpassCircuits>(contractConfig.zkConfigPath);

  // The private state store is encrypted at rest; base64 of the coin public key
  // gives a password with enough character classes to satisfy the provider.
  const accountId = walletAndMidnightProvider.getCoinPublicKey();
  const storagePassword = `${Buffer.from(accountId, 'hex').toString('base64')}!`;

  return {
    privateStateProvider: levelPrivateStateProvider<typeof NightpassPrivateStateId>({
      privateStateStoreName: contractConfig.privateStateStoreName,
      accountId,
      privateStoragePasswordProvider: () => storagePassword,
    }),
    publicDataProvider: indexerPublicDataProvider(config.indexer, config.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(config.proofServer, zkConfigProvider),
    walletProvider: walletAndMidnightProvider,
    midnightProvider: walletAndMidnightProvider,
  } as NightpassProviders;
};

export const deploy = async (
  providers: NightpassProviders,
  initialPrivateState: NightpassPrivateState,
): Promise<DeployedNightpassContract> =>
  deployContract(providers, {
    compiledContract: compiled,
    privateStateId: NightpassPrivateStateId,
    initialPrivateState,
  });

export const join = async (
  providers: NightpassProviders,
  contractAddress: string,
  initialPrivateState: NightpassPrivateState,
): Promise<DeployedNightpassContract> =>
  findDeployedContract(providers, {
    contractAddress,
    compiledContract: compiled,
    privateStateId: NightpassPrivateStateId,
    initialPrivateState,
  });

/** Reads the public half of the contract straight off the indexer. */
export const readLedger = async (providers: NightpassProviders, contractAddress: string) => {
  const state = await providers.publicDataProvider.queryContractState(contractAddress);
  return state === null ? null : Nightpass.ledger(state.data);
};

export const registerTool = async (
  contract: DeployedNightpassContract,
  slug: string,
  priceAtomic: bigint,
  quota: bigint,
) => {
  const tx = await contract.callTx.registerTool(toolIdFor(slug), priceAtomic, quota);
  return tx.public;
};

export const setToolActive = async (
  contract: DeployedNightpassContract,
  slug: string,
  active: boolean,
) => {
  const tx = await contract.callTx.setToolActive(toolIdFor(slug), active);
  return tx.public;
};

/**
 * Buy a pass. The nonce is generated here and written to private state BEFORE
 * the call, because the circuit reads it back through the `passNonce` witness.
 */
export const issuePass = async (
  providers: NightpassProviders,
  contract: DeployedNightpassContract,
  slug: string,
): Promise<{ commitment: Uint8Array; nonce: Uint8Array; txId: string; blockHeight: number }> => {
  const toolId = toolIdFor(slug);
  const nonce = freshSecret();

  const current = await requirePrivateState(providers);
  await providers.privateStateProvider.set(NightpassPrivateStateId, withPass(current, toolId, nonce));

  const tx = await contract.callTx.issuePass(toolId);
  return {
    commitment: tx.private.result as Uint8Array,
    nonce,
    txId: tx.public.txId,
    blockHeight: tx.public.blockHeight,
  };
};

/**
 * Spend one call. The local counter only advances once the transaction has
 * finalised, so a failed call does not silently burn quota.
 */
export const redeemCall = async (
  providers: NightpassProviders,
  contract: DeployedNightpassContract,
  slug: string,
): Promise<{ nullifier: Uint8Array; txId: string; blockHeight: number }> => {
  const toolId = toolIdFor(slug);
  const tx = await contract.callTx.redeemCall(toolId);

  const current = await requirePrivateState(providers);
  await providers.privateStateProvider.set(NightpassPrivateStateId, withCallSpent(current, toolId));

  return {
    nullifier: tx.private.result as Uint8Array,
    txId: tx.public.txId,
    blockHeight: tx.public.blockHeight,
  };
};

export const attestUsage = async (
  contract: DeployedNightpassContract,
  slug: string,
  auditor: string,
  callsClaimed: bigint,
): Promise<{ tag: Uint8Array; txId: string; blockHeight: number }> => {
  const tx = await contract.callTx.attestUsage(toolIdFor(slug), auditorIdFor(auditor), callsClaimed);
  return {
    tag: tx.private.result as Uint8Array,
    txId: tx.public.txId,
    blockHeight: tx.public.blockHeight,
  };
};

const requirePrivateState = async (providers: NightpassProviders): Promise<NightpassPrivateState> => {
  const state = await providers.privateStateProvider.get(NightpassPrivateStateId);
  if (state === null || state === undefined) {
    throw new Error('nightpass: private state is missing; deploy or join the contract first');
  }
  return state;
};

export { createNightpassPrivateState };
