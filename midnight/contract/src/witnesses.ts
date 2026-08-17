/*
 * The private half of Nightpass.
 *
 * Everything in this file stays on the agent's own machine. The proof server
 * consumes it to build a proof and then throws it away; none of it is ever
 * written to the ledger, and none of it appears in the public transcript.
 */

import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import type { Ledger } from './managed/nightpass/contract/index.js';

/** A pass the agent holds, plus how much of its quota it has already spent. */
export type PassSecret = {
  /** Per-pass randomness. Two passes for the same tool look unrelated on-chain. */
  readonly nonce: Uint8Array;
  /** How many calls have been redeemed. The next call uses this as its index. */
  readonly callsUsed: number;
};

export type NightpassPrivateState = {
  /** Long-lived agent (or publisher) secret. Losing it loses every pass. */
  readonly secretKey: Uint8Array;
  /** Passes held, keyed by lowercase hex tool id. */
  readonly passes: Readonly<Record<string, PassSecret>>;
};

export const toolKey = (toolId: Uint8Array): string => Buffer.from(toolId).toString('hex');

export const createNightpassPrivateState = (
  secretKey: Uint8Array,
  passes: Record<string, PassSecret> = {},
): NightpassPrivateState => ({ secretKey, passes });

/** Record a freshly issued pass. Returns a new state; nothing is mutated. */
export const withPass = (
  state: NightpassPrivateState,
  toolId: Uint8Array,
  nonce: Uint8Array,
): NightpassPrivateState => ({
  ...state,
  passes: { ...state.passes, [toolKey(toolId)]: { nonce, callsUsed: 0 } },
});

/**
 * Advance the call counter after a redemption has actually settled.
 *
 * This is deliberately not done inside the `callIndex` witness. A witness can
 * be evaluated more than once while a proof is being built, so incrementing
 * there would burn quota on calls that never reached the chain.
 */
export const withCallSpent = (
  state: NightpassPrivateState,
  toolId: Uint8Array,
): NightpassPrivateState => {
  const key = toolKey(toolId);
  const pass = state.passes[key];
  if (pass === undefined) {
    throw new Error(`nightpass: no pass held for tool ${key}`);
  }
  return {
    ...state,
    passes: { ...state.passes, [key]: { ...pass, callsUsed: pass.callsUsed + 1 } },
  };
};

const requirePass = (state: NightpassPrivateState, toolId: Uint8Array): PassSecret => {
  const pass = state.passes[toolKey(toolId)];
  if (pass === undefined) {
    throw new Error(
      `nightpass: no pass held for tool ${toolKey(toolId)}. Buy one with issuePass first.`,
    );
  }
  return pass;
};

export const witnesses = {
  secretKey: ({
    privateState,
  }: WitnessContext<Ledger, NightpassPrivateState>): [NightpassPrivateState, Uint8Array] => [
    privateState,
    privateState.secretKey,
  ],

  passNonce: (
    { privateState }: WitnessContext<Ledger, NightpassPrivateState>,
    toolId: Uint8Array,
  ): [NightpassPrivateState, Uint8Array] => [privateState, requirePass(privateState, toolId).nonce],

  callIndex: (
    { privateState }: WitnessContext<Ledger, NightpassPrivateState>,
    toolId: Uint8Array,
  ): [NightpassPrivateState, bigint] => [
    privateState,
    BigInt(requirePass(privateState, toolId).callsUsed),
  ],

  /*
   * The Merkle path is rebuilt from public state every time rather than stored.
   * The tree grows as other agents buy passes, so a cached path would go stale;
   * reading the current tree is both cheaper and always correct.
   */
  passPath: (
    { ledger, privateState }: WitnessContext<Ledger, NightpassPrivateState>,
    commitment: Uint8Array,
  ): [NightpassPrivateState, ReturnType<Ledger['passCommitments']['pathForLeaf']>] => {
    const path = ledger.passCommitments.findPathForLeaf(commitment);
    if (path === undefined) {
      throw new Error(
        'nightpass: this pass is not in the issued set. It was never issued, or the ' +
          'indexer has not caught up with the transaction that issued it.',
      );
    }
    return [privateState, path];
  },
};
