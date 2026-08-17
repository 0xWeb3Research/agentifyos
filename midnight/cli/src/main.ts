/*
 * nightpass <command> [--network preview|preprod]
 *
 *   deploy    put the contract on a real Midnight network
 *   demo      run the whole story end to end and print what leaked
 *   state     read the public ledger back off the indexer
 *   audit     verify an attestation the way a regulator would
 */

import { createLogger } from './logger-utils.ts';
import { configFor, loadEnv, resolveNetwork } from './config.ts';
import { blank, heading, hex, note, rule, short, step, withStatus } from './ui.ts';
import { buildWallet, randomSeed } from './wallet.ts';
import {
  attestUsage,
  configureProviders,
  createNightpassPrivateState,
  deploy,
  freshSecret,
  issuePass,
  join,
  readLedger,
  redeemCall,
  registerTool,
  toolIdFor,
  auditorIdFor,
} from './api.ts';
import { loadDeployment, loadSeed, saveDeployment, saveSeed } from './state.ts';
import { Nightpass } from '@nightpass/contract';

// The same derivations the circuits use, callable off-chain. This is exactly
// the surface an auditor gets, which is why the demo verifies with it.
const { pureCircuits } = Nightpass;

const arg = (name: string, fallback?: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

// midnight/.env first, so every default below can be overridden from one file.
await loadEnv();

const command = process.argv[2] ?? 'demo';
const network = resolveNetwork(arg('network'));
const config = configFor(network);
const logger = await createLogger(config.logDir);

/** The catalog the demo lists, priced the way the marketplace quotes. */
const CATALOG = [
  { slug: 'algo-market-data', price: 2_000n, quota: 5n },
  { slug: 'page-scraper', price: 5_000n, quota: 3n },
  { slug: 'text-summarizer', price: 10_000n, quota: 2n },
];

const openWallet = async () => {
  let seed = loadSeed(network);
  if (seed === null) {
    seed = randomSeed();
    const file = saveSeed(network, seed);
    step('No deployer seed found, so a fresh wallet was created.');
    note(`Seed saved to ${file} (gitignored). Keep it: it owns the deployment.`);
  }
  return buildWallet(config, seed);
};

const requireDeployment = () => {
  const record = loadDeployment(network);
  if (record === null) {
    throw new Error(`no deployment found for ${network}. Run "deploy" first.`);
  }
  return record;
};

// ---------------------------------------------------------------------------

const runDeploy = async () => {
  heading(`Nightpass — deploying to Midnight ${network}`);
  const wallet = await openWallet();
  const providers = await configureProviders(wallet, config);

  const contract = await withStatus('Deploying contract (this proves the constructor)', () =>
    deploy(providers, createNightpassPrivateState(freshSecret())),
  );
  const address = contract.deployTxData.public.contractAddress;

  saveDeployment({
    network,
    contractAddress: address,
    deployTxId: contract.deployTxData.public.txId,
    deployedAt: new Date().toISOString(),
    compiler: '0.31.1',
  });

  blank();
  rule();
  note(`contract     ${address}`);
  note(`deploy tx    ${contract.deployTxData.public.txId}`);
  note(`network      ${network}`);
  rule();
  step('Saved to midnight/deployment.json. Run "demo" next.');
};

// ---------------------------------------------------------------------------

const runDemo = async () => {
  const record = requireDeployment();
  heading(`Nightpass — a shielded agent run on Midnight ${network}`);
  note(`contract ${record.contractAddress}`);

  const wallet = await openWallet();
  const providers = await configureProviders(wallet, config);

  // The publisher and the agent are separate identities with separate secrets.
  const publisherSecret = freshSecret();
  const agentSecret = freshSecret();

  const publisher = await withStatus('Joining contract as the publisher', () =>
    join(providers, record.contractAddress, createNightpassPrivateState(publisherSecret)),
  );

  heading('1. A publisher lists tools. Price is public; the publisher is not.');
  const listed: string[] = [];
  for (const tool of CATALOG) {
    const before = await readLedger(providers, record.contractAddress);
    if (before?.tools.member(toolIdFor(tool.slug))) {
      note(`${tool.slug} is already listed, skipping`);
      listed.push(tool.slug);
      continue;
    }
    const tx = await withStatus(`Listing ${tool.slug} at ${Number(tool.price) / 1e6} per pass`, () =>
      registerTool(publisher, tool.slug, tool.price, tool.quota),
    );
    note(`tx ${tx.txId}`);
    note(`   in block ${tx.blockHeight}`);
    listed.push(tool.slug);
  }

  heading('2. An agent buys a pass. The ledger records that one was issued.');
  await providers.privateStateProvider.set(
    'nightpassPrivateState',
    createNightpassPrivateState(agentSecret),
  );
  const agent = await withStatus('Joining contract as the agent', () =>
    join(providers, record.contractAddress, createNightpassPrivateState(agentSecret)),
  );

  const target = CATALOG[0];
  const pass = await withStatus(`Buying a pass for ${target.slug}`, () =>
    issuePass(providers, agent, target.slug),
  );
  note(`commitment   ${hex(pass.commitment)}`);
  note(`tx           ${pass.txId}`);
  note(`block        ${pass.blockHeight}`);
  note('The commitment is public. Nothing ties it to this agent.');

  heading('3. The agent spends calls. Each one proves entitlement in ZK.');
  const nullifiers: Uint8Array[] = [];
  const CALLS = 3;
  for (let i = 0; i < CALLS; i++) {
    const call = await withStatus(`Redeeming call ${i + 1} of ${CALLS}`, () =>
      redeemCall(providers, agent, target.slug),
    );
    nullifiers.push(call.nullifier);
    note(`nullifier    ${hex(call.nullifier)}`);
    note(`tx           ${call.txId}`);
  }

  blank();
  note('Those nullifiers came from ONE pass. Nothing relates them to each other,');
  note('so an observer cannot tell whether that was one agent or three.');

  heading('4. Selective disclosure: the same run, provable to one auditor.');
  const auditor = 'fca-uk';
  const attestation = await withStatus(`Attesting ${CALLS} calls to auditor "${auditor}"`, () =>
    attestUsage(agent, target.slug, auditor, BigInt(CALLS)),
  );
  note(`audit tag    ${hex(attestation.tag)}`);
  note(`tx           ${attestation.txId}`);
  note(`block        ${attestation.blockHeight}`);

  // An auditor holding the agent's pass secret can rebuild the whole history.
  const commitment = pureCircuits.passCommitment(toolIdFor(target.slug), agentSecret, pass.nonce);
  const expectedTag = pureCircuits.auditTag(auditorIdFor(auditor), commitment, BigInt(CALLS));
  const ledgerNow = await readLedger(providers, record.contractAddress);

  const tagMatches = hex(expectedTag) === hex(attestation.tag);
  const everyCallChecks = Array.from({ length: CALLS }, (_, i) =>
    ledgerNow!.spentCalls.member(pureCircuits.callNullifier(commitment, BigInt(i))),
  ).every(Boolean);
  const nextCallAbsent = !ledgerNow!.spentCalls.member(
    pureCircuits.callNullifier(commitment, BigInt(CALLS)),
  );

  blank();
  note(`auditor recomputes the tag            ${tagMatches ? 'matches' : 'MISMATCH'}`);
  note(`every claimed call found on-chain     ${everyCallChecks ? 'yes' : 'NO'}`);
  note(`claim is exact, not a lower bound     ${nextCallAbsent ? 'yes' : 'NO'}`);

  heading('5. What the public ledger actually reveals');
  const tool = ledgerNow!.tools.lookup(toolIdFor(target.slug));
  rule();
  note(`tools listed             ${ledgerNow!.tools.size()}`);
  note(`passes issued            ${ledgerNow!.passesIssued}`);
  note(`calls served             ${ledgerNow!.callsServed.lookup(toolIdFor(target.slug))}   (${target.slug})`);
  note(`price per pass           ${Number(tool.priceAtomic) / 1e6}`);
  note(`nullifiers recorded      ${ledgerNow!.spentCalls.size()}`);
  note(`attestations             ${ledgerNow!.attestations.size()}`);
  rule();
  note('and nowhere in that state: which agent, holding which pass, called what.');
  blank();
};

// ---------------------------------------------------------------------------

const runState = async () => {
  const record = requireDeployment();
  heading(`Nightpass — public ledger on ${network}`);
  note(`contract ${record.contractAddress}`);

  // Reading needs no wallet and no proof server: it is public state.
  const providers = { publicDataProvider: (await import('@midnight-ntwrk/midnight-js-indexer-public-data-provider')).indexerPublicDataProvider(config.indexer, config.indexerWS) } as any;
  const ledgerNow = await withStatus('Reading state from the public indexer', () =>
    readLedger(providers, record.contractAddress),
  );
  if (ledgerNow === null) {
    note('no contract state at that address yet');
    return;
  }

  blank();
  rule();
  note(`tools listed         ${ledgerNow.tools.size()}`);
  note(`passes issued        ${ledgerNow.passesIssued}`);
  note(`calls redeemed       ${ledgerNow.spentCalls.size()}`);
  note(`attestations         ${ledgerNow.attestations.size()}`);
  rule();
  for (const [id, tool] of ledgerNow.tools) {
    const served = ledgerNow.callsServed.member(id) ? ledgerNow.callsServed.lookup(id) : 0n;
    note(
      `${short(id, 12).padEnd(20)} ${(Number(tool.priceAtomic) / 1e6).toFixed(3).padStart(7)}  quota ${tool.quota}  served ${served}  ${tool.active ? 'active' : 'delisted'}`,
    );
  }
  rule();
};

// ---------------------------------------------------------------------------

try {
  switch (command) {
    case 'deploy':
      await runDeploy();
      break;
    case 'demo':
      await runDemo();
      break;
    case 'state':
      await runState();
      break;
    default:
      console.error(`unknown command "${command}". Use deploy, demo, or state.`);
      process.exit(1);
  }
  process.exit(0);
} catch (e) {
  logger.error(e);
  blank();
  console.error(`  ✗ ${e instanceof Error ? e.message : String(e)}`);
  blank();
  process.exit(1);
}
