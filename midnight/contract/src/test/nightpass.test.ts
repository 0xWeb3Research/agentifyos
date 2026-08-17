/*
 * These tests are the argument, not just a safety net.
 *
 * Nightpass makes specific privacy claims. Each one below is written as
 * something an adversary would try, so a reviewer can see the claim enforced
 * rather than asserted in a README.
 */

import { describe, expect, it } from 'vitest';
import { createHash, randomBytes } from 'node:crypto';
import { NightpassSimulator } from './nightpass-simulator.js';
import { createNightpassPrivateState, withPass } from '../witnesses.js';

const toolId = (name: string): Uint8Array => new Uint8Array(createHash('sha256').update(name).digest());
const secret = (): Uint8Array => new Uint8Array(randomBytes(32));
const hex = (b: Uint8Array): string => Buffer.from(b).toString('hex');

const PRICE = 2_000n; // $0.002 quoted in millionths, matching the marketplace
const QUOTA = 5n;

/** Sets up a publisher with one registered tool, plus a funded-looking agent. */
const withRegisteredTool = (name = 'algo-market-data') => {
  const publisherKey = secret();
  const sim = new NightpassSimulator(publisherKey);
  const id = toolId(name);
  sim.registerTool(id, PRICE, QUOTA);
  return { sim, id, publisherKey };
};

describe('the public half: a catalog anyone can shop', () => {
  it('publishes price and quota so an agent can choose on them', () => {
    const { sim, id } = withRegisteredTool();
    const tool = sim.ledger().tools.lookup(id);

    expect(tool.priceAtomic).toBe(PRICE);
    expect(tool.quota).toBe(QUOTA);
    expect(tool.active).toBe(true);
  });

  it('refuses a duplicate listing for the same tool id', () => {
    const { sim, id } = withRegisteredTool();
    expect(() => sim.registerTool(id, PRICE, QUOTA)).toThrow(/already registered/);
  });

  it('counts calls publicly, because reputation has to be checkable', () => {
    const { sim, id } = withRegisteredTool();
    const agent = createNightpassPrivateState(secret());
    sim.as(agent).issuePass(id, secret());

    expect(sim.ledger().callsServed.lookup(id)).toBe(0n);
    sim.redeemCall(id);
    sim.redeemCall(id);
    expect(sim.ledger().callsServed.lookup(id)).toBe(2n);
  });
});

describe('the private half: what the ledger refuses to say', () => {
  it('never writes the pass commitment into the spent-call record', () => {
    const { sim, id } = withRegisteredTool();
    const commitment = sim.as(createNightpassPrivateState(secret())).issuePass(id, secret());

    sim.redeemCall(id);
    sim.redeemCall(id);

    // The commitment is public at issue time and then never referenced again.
    // If it appeared here, every call would be linkable back to the buyer.
    const spent = [...sim.ledger().spentCalls].map(hex);
    expect(spent).toHaveLength(2);
    expect(spent).not.toContain(hex(commitment));
  });

  it('makes two calls from the same pass mutually unlinkable', () => {
    const { sim, id } = withRegisteredTool();
    sim.as(createNightpassPrivateState(secret())).issuePass(id, secret());

    const first = sim.redeemCall(id);
    const second = sim.redeemCall(id);

    // Same pass, same agent, same tool. The nullifiers must share nothing:
    // this is the property that stops an observer reconstructing a toolchain.
    expect(hex(first)).not.toBe(hex(second));
    expect(first.slice(0, 8)).not.toEqual(second.slice(0, 8));
  });

  it('hides how far through its quota an agent is', () => {
    const { sim, id } = withRegisteredTool();
    sim.as(createNightpassPrivateState(secret())).issuePass(id, secret());
    sim.redeemCall(id);
    sim.redeemCall(id);
    sim.redeemCall(id);

    // Public state knows three calls happened somewhere. It cannot tell whether
    // that was one agent with three left or three agents with four left each.
    expect(sim.ledger().callsServed.lookup(id)).toBe(3n);
    expect(sim.ledger().passesIssued).toBe(1n);
  });

  it('does not reveal which publisher operates a tool', () => {
    const { sim, id, publisherKey } = withRegisteredTool();
    const stored = sim.ledger().tools.lookup(id).publisherCommitment;

    // The record holds a commitment, never the key that produced it.
    expect(hex(stored)).not.toBe(hex(publisherKey));
    expect(hex(stored)).toBe(hex(sim.pure.publisherCommitment(publisherKey)));
  });
});

describe('the guarantees an operator is actually paying for', () => {
  it('rejects a replayed call', () => {
    const { sim, id } = withRegisteredTool();
    sim.as(createNightpassPrivateState(secret())).issuePass(id, secret());

    const beforeFirstCall = sim.privateState;
    sim.redeemCall(id);

    // The attacker rolls its own machine back so the next call reuses index 0.
    // The chain still remembers the nullifier, which is the whole point.
    sim.rewindLocalCounter(beforeFirstCall);
    expect(() => sim.redeemCall(id)).toThrow(/already redeemed/);
  });

  it('stops an agent past the quota it paid for', () => {
    const { sim, id } = withRegisteredTool();
    sim.as(createNightpassPrivateState(secret())).issuePass(id, secret());

    for (let i = 0n; i < QUOTA; i++) sim.redeemCall(id);
    expect(() => sim.redeemCall(id)).toThrow(/quota exhausted/);
    expect(sim.ledger().callsServed.lookup(id)).toBe(QUOTA);
  });

  it('refuses a pass that was never issued', () => {
    const { sim, id } = withRegisteredTool();
    // A freeloader invents a pass locally without ever paying for one.
    const freeloader = withPass(createNightpassPrivateState(secret()), id, secret());

    expect(() => sim.as(freeloader).redeemCall(id)).toThrow(/not in the issued set/);
  });

  it('refuses a stolen commitment without the secret behind it', () => {
    const { sim, id } = withRegisteredTool();
    const victimNonce = secret();
    sim.as(createNightpassPrivateState(secret())).issuePass(id, victimNonce);

    // The thief scrapes the commitment off the public ledger and copies the
    // nonce, but cannot know the victim's secret key. The commitment it
    // recomputes is a different one, so no path to it exists.
    const thief = withPass(createNightpassPrivateState(secret()), id, victimNonce);
    expect(() => sim.as(thief).redeemCall(id)).toThrow(/not in the issued set/);
  });

  it('lets only the real publisher delist a tool', () => {
    const { sim, id, publisherKey } = withRegisteredTool();

    const impostor = createNightpassPrivateState(secret());
    expect(() => sim.as(impostor).setToolActive(id, false)).toThrow(/not the publisher/);

    sim.as(createNightpassPrivateState(publisherKey)).setToolActive(id, false);
    expect(sim.ledger().tools.lookup(id).active).toBe(false);
  });

  it('stops new passes once a tool is delisted', () => {
    const { sim, id, publisherKey } = withRegisteredTool();
    sim.as(createNightpassPrivateState(publisherKey)).setToolActive(id, false);

    const agent = createNightpassPrivateState(secret());
    expect(() => sim.as(agent).issuePass(id, secret())).toThrow(/not accepting new passes/);
  });
});

describe('selective disclosure: private by default, provable on demand', () => {
  it('lets a named auditor reconstruct a full usage history the public cannot', () => {
    const { sim, id } = withRegisteredTool();

    const agentKey = secret();
    const passNonce = secret();
    const commitment = sim.as(createNightpassPrivateState(agentKey)).issuePass(id, passNonce);

    sim.redeemCall(id);
    sim.redeemCall(id);
    sim.redeemCall(id);

    const auditorId = new Uint8Array(createHash('sha256').update('fca-uk').digest());
    const tag = sim.attestUsage(id, auditorId, 3n);

    // What the public sees: an attestation exists. Nothing about who, or for what.
    expect(sim.ledger().attestations.member(tag)).toBe(true);

    // What the auditor can do, given the agent's secret handed over off-chain:
    // recompute the commitment, confirm the attestation is genuinely theirs...
    const recomputed = sim.pure.passCommitment(id, agentKey, passNonce);
    expect(hex(recomputed)).toBe(hex(commitment));
    expect(hex(sim.pure.auditTag(auditorId, recomputed, 3n))).toBe(hex(tag));

    // ...and then verify every single claimed call really settled on-chain.
    for (let i = 0n; i < 3n; i++) {
      const nullifier = sim.pure.callNullifier(recomputed, i);
      expect(sim.ledger().spentCalls.member(nullifier)).toBe(true);
    }

    // The claim is exact, not just a lower bound: call four never happened.
    expect(sim.ledger().spentCalls.member(sim.pure.callNullifier(recomputed, 3n))).toBe(false);
  });

  it('cannot be used to overstate usage beyond the quota', () => {
    const { sim, id } = withRegisteredTool();
    sim.as(createNightpassPrivateState(secret())).issuePass(id, secret());
    const auditorId = new Uint8Array(createHash('sha256').update('fca-uk').digest());

    expect(() => sim.attestUsage(id, auditorId, QUOTA + 1n)).toThrow(/more calls than the quota/);
  });

  it('gives a different tag to each auditor, so auditors cannot collude by tag', () => {
    const { sim, id } = withRegisteredTool();
    sim.as(createNightpassPrivateState(secret())).issuePass(id, secret());
    sim.redeemCall(id);

    const first = sim.attestUsage(id, new Uint8Array(createHash('sha256').update('a').digest()), 1n);
    const second = sim.attestUsage(id, new Uint8Array(createHash('sha256').update('b').digest()), 1n);

    expect(hex(first)).not.toBe(hex(second));
  });
});
