/*
 * The private state helpers.
 *
 * These never touch the chain, but they decide what the circuits are handed, so
 * a bug here is a privacy or a quota bug rather than a cosmetic one. In
 * particular: quota is spent by advancing a counter in this file, and the whole
 * unlinkability argument rests on the nonce being per-pass.
 */

import { describe, expect, it } from 'vitest';
import { createHash, randomBytes } from 'node:crypto';
import {
  createNightpassPrivateState,
  toolKey,
  withCallSpent,
  withPass,
  witnesses,
} from '../witnesses.js';

const toolId = (name: string): Uint8Array => new Uint8Array(createHash('sha256').update(name).digest());
const secret = (): Uint8Array => new Uint8Array(randomBytes(32));

const ctx = (privateState: ReturnType<typeof createNightpassPrivateState>) =>
  ({ privateState, ledger: undefined, contractAddress: '' }) as never;

describe('private state bookkeeping', () => {
  it('starts with a secret and no passes', () => {
    const sk = secret();
    const state = createNightpassPrivateState(sk);
    expect(state.secretKey).toBe(sk);
    expect(Object.keys(state.passes)).toHaveLength(0);
  });

  it('keys passes by tool, so an agent can hold several at once', () => {
    let state = createNightpassPrivateState(secret());
    state = withPass(state, toolId('algo-market-data'), secret());
    state = withPass(state, toolId('page-scraper'), secret());

    expect(Object.keys(state.passes)).toHaveLength(2);
    expect(state.passes[toolKey(toolId('algo-market-data'))]).toBeDefined();
    expect(state.passes[toolKey(toolId('page-scraper'))]).toBeDefined();
  });

  it('never mutates the state it was given', () => {
    const before = createNightpassPrivateState(secret());
    const after = withPass(before, toolId('algo-market-data'), secret());

    // Circuits are re-run while a proof is built. Mutating in place would let a
    // retry observe state from an attempt that never reached the chain.
    expect(Object.keys(before.passes)).toHaveLength(0);
    expect(Object.keys(after.passes)).toHaveLength(1);
    expect(after).not.toBe(before);
  });

  it('advances only the tool whose call was spent', () => {
    const a = toolId('algo-market-data');
    const b = toolId('page-scraper');
    let state = withPass(withPass(createNightpassPrivateState(secret()), a, secret()), b, secret());

    state = withCallSpent(state, a);
    state = withCallSpent(state, a);

    expect(state.passes[toolKey(a)].callsUsed).toBe(2);
    expect(state.passes[toolKey(b)].callsUsed).toBe(0);
  });

  it('keeps the nonce fixed while the counter moves', () => {
    const id = toolId('algo-market-data');
    const nonce = secret();
    let state = withPass(createNightpassPrivateState(secret()), id, nonce);
    state = withCallSpent(state, id);

    // The commitment is derived from the nonce, so changing it mid-pass would
    // strand every remaining call: the tree holds the original commitment.
    expect(state.passes[toolKey(id)].nonce).toBe(nonce);
  });

  it('refuses to spend a call against a pass it does not hold', () => {
    const state = createNightpassPrivateState(secret());
    expect(() => withCallSpent(state, toolId('algo-market-data'))).toThrow(/no pass held/);
  });
});

describe('the witnesses handed to the circuits', () => {
  it('returns the secret without altering state', () => {
    const state = createNightpassPrivateState(secret());
    const [next, value] = witnesses.secretKey(ctx(state));
    expect(value).toBe(state.secretKey);
    expect(next).toBe(state);
  });

  it('returns the nonce and index for the tool being called', () => {
    const id = toolId('algo-market-data');
    const nonce = secret();
    let state = withPass(createNightpassPrivateState(secret()), id, nonce);
    state = withCallSpent(state, id);

    expect(witnesses.passNonce(ctx(state), id)[1]).toBe(nonce);
    expect(witnesses.callIndex(ctx(state), id)[1]).toBe(1n);
  });

  it('says so plainly when no pass is held, rather than proving nonsense', () => {
    const state = createNightpassPrivateState(secret());
    const id = toolId('algo-market-data');

    expect(() => witnesses.passNonce(ctx(state), id)).toThrow(/no pass held/);
    expect(() => witnesses.callIndex(ctx(state), id)).toThrow(/no pass held/);
  });

  it('does not advance the call index on its own', () => {
    const id = toolId('algo-market-data');
    const state = withPass(createNightpassPrivateState(secret()), id, secret());

    // A witness can be evaluated more than once while a proof is built. If it
    // incremented, a single call would burn several units of quota.
    expect(witnesses.callIndex(ctx(state), id)[1]).toBe(0n);
    expect(witnesses.callIndex(ctx(state), id)[1]).toBe(0n);
    expect(state.passes[toolKey(id)].callsUsed).toBe(0);
  });
});
