/* Local, gitignored state: the deployer seed and the address it deployed to. */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { currentDir } from './config.ts';

const dir = path.resolve(currentDir, '..', '.nightpass');

const ensureDir = () => mkdirSync(dir, { recursive: true });

const seedFile = (network: string) => path.join(dir, `seed.${network}.txt`);
const deploymentFile = (network: string) => path.join(dir, `deployment.${network}.json`);

/** Committed alongside the code: an address is public, and reviewers need it. */
export const publicRecordFile = path.resolve(currentDir, '..', '..', 'deployment.json');

export const loadSeed = (network: string): string | null => {
  if (process.env.NIGHTPASS_SEED) return process.env.NIGHTPASS_SEED;
  const file = seedFile(network);
  return existsSync(file) ? readFileSync(file, 'utf8').trim() : null;
};

export const saveSeed = (network: string, seed: string): string => {
  ensureDir();
  const file = seedFile(network);
  writeFileSync(file, `${seed}\n`, { mode: 0o600 });
  return file;
};

export type DeploymentRecord = {
  network: string;
  contractAddress: string;
  deployTxId?: string;
  deployedAt: string;
  compiler: string;
};

export const saveDeployment = (record: DeploymentRecord): void => {
  ensureDir();
  writeFileSync(deploymentFile(record.network), `${JSON.stringify(record, null, 2)}\n`);

  const all: Record<string, DeploymentRecord> = existsSync(publicRecordFile)
    ? JSON.parse(readFileSync(publicRecordFile, 'utf8'))
    : {};
  all[record.network] = record;
  writeFileSync(publicRecordFile, `${JSON.stringify(all, null, 2)}\n`);
};

export const loadDeployment = (network: string): DeploymentRecord | null => {
  if (process.env.NIGHTPASS_CONTRACT) {
    return {
      network,
      contractAddress: process.env.NIGHTPASS_CONTRACT,
      deployedAt: 'from NIGHTPASS_CONTRACT',
      compiler: 'unknown',
    };
  }
  const file = deploymentFile(network);
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
};
