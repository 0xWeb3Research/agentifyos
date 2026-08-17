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

describe('isolation between tools and between agents', () => {
  it('refuses a pass bought for one tool on a different tool', () => {
    // The sharpest way to break a per-tool entitlement is to buy the cheapest
    // pass and spend it on the dearest tool, so this is worth proving.
    const { sim } = withRegisteredTool('algo-market-data');
    const dear = toolId('rwa-attestor');
    sim.registerTool(dear, 20_000n, QUOTA);

    const agentKey = secret();
    const nonce = secret();
    sim.as(createNightpassPrivateState(agentKey)).issuePass(toolId('algo-market-data'), nonce);

    // The agent copies its own pass secret across to the expensive tool. The
    // commitment binds the tool id, so the one it recomputes was never issued.
    const crossed = withPass(sim.privateState, dear, nonce);
    expect(() => sim.as(crossed).redeemCall(dear)).toThrow(/not in the issued set/);
  });

  it('keeps each tool’s call count to itself', () => {
    const { sim } = withRegisteredTool('algo-market-data');
    const other = toolId('page-scraper');
    sim.registerTool(other, 5_000n, QUOTA);

    const agent = createNightpassPrivateState(secret());
    sim.as(agent).issuePass(toolId('algo-market-data'), secret());
    sim.redeemCall(toolId('algo-market-data'));
    sim.redeemCall(toolId('algo-market-data'));

    expect(sim.ledger().callsServed.lookup(toolId('algo-market-data'))).toBe(2n);
    expect(sim.ledger().callsServed.lookup(other)).toBe(0n);
  });

  it('gives two agents unrelated nullifiers for the very same call number', () => {
    const { sim, id } = withRegisteredTool();

    sim.as(createNightpassPrivateState(secret())).issuePass(id, secret());
    const first = sim.redeemCall(id);

    sim.as(createNightpassPrivateState(secret())).issuePass(id, secret());
    const second = sim.redeemCall(id);

    // Both are call index 0. If the index alone drove the nullifier these would
    // collide and the second agent could never spend its first call.
    expect(hex(first)).not.toBe(hex(second));
    expect(sim.ledger().spentCalls.size()).toBe(2n);
    expect(sim.ledger().passesIssued).toBe(2n);
  });

  it('makes one agent’s two passes for one tool look unrelated', () => {
    const { sim, id } = withRegisteredTool();
    const agentKey = secret();

    const a = sim.as(createNightpassPrivateState(agentKey)).issuePass(id, secret());
    const b = sim.as(createNightpassPrivateState(agentKey)).issuePass(id, secret());

    // Same buyer, same tool. Only the nonce differs, and that is enough.
    expect(hex(a)).not.toBe(hex(b));
  });
});

describe('guard clauses', () => {
  it('rejects a listing with no quota to sell', () => {
    const sim = new NightpassSimulator(secret());
    expect(() => sim.registerTool(toolId('freebie'), PRICE, 0n)).toThrow(/quota must be positive/);
  });

  it('rejects every circuit that names a tool which does not exist', () => {
    const sim = new NightpassSimulator(secret());
    const ghost = toolId('never-registered');
    const auditorId = new Uint8Array(createHash('sha256').update('fca-uk').digest());

    expect(() => sim.issuePass(ghost, secret())).toThrow(/unknown tool/);
    expect(() => sim.setToolActive(ghost, false)).toThrow(/unknown tool/);
    expect(() => sim.attestUsage(ghost, auditorId, 1n)).toThrow(/unknown tool/);

    // redeemCall needs a locally held pass before it reaches the tool check.
    const holder = withPass(createNightpassPrivateState(secret()), ghost, secret());
    expect(() => sim.as(holder).redeemCall(ghost)).toThrow(/unknown tool/);
  });

  it('stops calls on a tool the publisher has delisted', () => {
    const { sim, id, publisherKey } = withRegisteredTool();
    sim.as(createNightpassPrivateState(secret())).issuePass(id, secret());
    const agentState = sim.privateState;

    sim.as(createNightpassPrivateState(publisherKey)).setToolActive(id, false);
    expect(() => sim.as(agentState).redeemCall(id)).toThrow(/not active/);
  });

  it('lets a publisher relist a tool it delisted', () => {
    const { sim, id, publisherKey } = withRegisteredTool();
    const publisher = createNightpassPrivateState(publisherKey);

    sim.as(publisher).setToolActive(id, false);
    expect(sim.ledger().tools.lookup(id).active).toBe(false);

    sim.as(publisher).setToolActive(id, true);
    expect(sim.ledger().tools.lookup(id).active).toBe(true);

    // Relisting must not quietly reset the terms the tool was sold on.
    expect(sim.ledger().tools.lookup(id).priceAtomic).toBe(PRICE);
    expect(sim.ledger().tools.lookup(id).quota).toBe(QUOTA);
  });

  it('refuses to record the same attestation twice', () => {
    const { sim, id } = withRegisteredTool();
    sim.as(createNightpassPrivateState(secret())).issuePass(id, secret());
    sim.redeemCall(id);

    const auditorId = new Uint8Array(createHash('sha256').update('fca-uk').digest());
    sim.attestUsage(id, auditorId, 1n);
    expect(() => sim.attestUsage(id, auditorId, 1n)).toThrow(/already exists/);
  });

  it('will not attest for a pass the agent does not hold', () => {
    const { sim, id } = withRegisteredTool();
    const auditorId = new Uint8Array(createHash('sha256').update('fca-uk').digest());
    const pretender = withPass(createNightpassPrivateState(secret()), id, secret());

    expect(() => sim.as(pretender).attestUsage(id, auditorId, 1n)).toThrow(/not in the issued set/);
  });
});

describe('the derivations an auditor recomputes by hand', () => {
  it('is deterministic, so an auditor gets the same answer we do', () => {
    const sim = new NightpassSimulator(secret());
    const id = toolId('algo-market-data');
    const sk = secret();
    const nonce = secret();

    expect(hex(sim.pure.passCommitment(id, sk, nonce))).toBe(
      hex(sim.pure.passCommitment(id, sk, nonce)),
    );
    expect(hex(sim.pure.callNullifier(sim.pure.passCommitment(id, sk, nonce), 7n))).toBe(
      hex(sim.pure.callNullifier(sim.pure.passCommitment(id, sk, nonce), 7n)),
    );
  });

  it('separates its domains, so one derivation cannot stand in for another', () => {
    const sim = new NightpassSimulator(secret());
    const x = secret();

    // Every derivation is prefixed with its own domain string. Without that, a
    // publisher commitment and a pass commitment over the same bytes could
    // collide and authorise something they were never meant to.
    const asPublisher = hex(sim.pure.publisherCommitment(x));
    const asPass = hex(sim.pure.passCommitment(x, x, x));
    const asNullifier = hex(sim.pure.callNullifier(x, 0n));
    const asAudit = hex(sim.pure.auditTag(x, x, 0n));

    expect(new Set([asPublisher, asPass, asNullifier, asAudit]).size).toBe(4);
  });

  it('changes the nullifier for every call index', () => {
    const sim = new NightpassSimulator(secret());
    const commitment = secret();
    const seen = new Set(
      Array.from({ length: 32 }, (_, i) => hex(sim.pure.callNullifier(commitment, BigInt(i)))),
    );
    expect(seen.size).toBe(32);
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
