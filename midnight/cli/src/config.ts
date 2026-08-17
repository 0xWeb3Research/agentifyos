import path from 'node:path';
import { existsSync } from 'node:fs';
import { setNetworkId } from '@midnight-ntwrk/midnight-js/network-id';

export const currentDir = path.resolve(new URL(import.meta.url).pathname, '..');

/** midnight/.env, loaded before anything reads process.env. */
export const envFile = path.resolve(currentDir, '..', '..', '.env');

export const loadEnv = async (): Promise<void> => {
  if (!existsSync(envFile)) return;
  const { config } = await import('dotenv');
  config({ path: envFile, quiet: true });
};

export const contractConfig = {
  privateStateStoreName: 'nightpass-private-state',
  zkConfigPath: path.resolve(currentDir, '..', '..', 'contract', 'src', 'managed', 'nightpass'),
};

export interface Config {
  readonly name: string;
  readonly logDir: string;
  readonly indexer: string;
  readonly indexerWS: string;
  readonly node: string;
  readonly proofServer: string;
  /** Where a human goes to fund the deployer. Printed, never scraped. */
  readonly faucet: string;
}

const logFile = (network: string) =>
  path.resolve(currentDir, '..', 'logs', network, `${new Date().toISOString()}.log`);

/** An empty env var means "not set", not "set to empty string". */
const env = (name: string): string | undefined => {
  const value = process.env[name];
  return value !== undefined && value.trim() !== '' ? value.trim() : undefined;
};

const DEFAULTS = {
  preview: {
    indexer: 'https://indexer.preview.midnight.network/api/v3/graphql',
    indexerWS: 'wss://indexer.preview.midnight.network/api/v3/graphql/ws',
    node: 'https://rpc.preview.midnight.network',
    faucet: 'https://midnight-tmnight-preview.nethermind.dev/',
  },
  preprod: {
    indexer: 'https://indexer.preprod.midnight.network/api/v3/graphql',
    indexerWS: 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws',
    node: 'https://rpc.preprod.midnight.network',
    faucet: 'https://midnight-tmnight-preprod.nethermind.dev/',
  },
} as const;

export type NetworkName = keyof typeof DEFAULTS;

export const isNetworkName = (value: string): value is NetworkName => value in DEFAULTS;

export const configFor = (network: string): Config => {
  if (!isNetworkName(network)) {
    throw new Error(`unknown network "${network}". Use "preview" or "preprod".`);
  }
  const defaults = DEFAULTS[network];

  // Registering the network id is what makes addresses and keys network-bound,
  // so it has to happen before any wallet or contract call.
  setNetworkId(network);

  return {
    name: network,
    logDir: logFile(network),
    indexer: env('NIGHTPASS_INDEXER') ?? defaults.indexer,
    indexerWS: env('NIGHTPASS_INDEXER_WS') ?? defaults.indexerWS,
    node: env('NIGHTPASS_NODE') ?? defaults.node,
    proofServer: env('NIGHTPASS_PROOF_SERVER') ?? 'http://127.0.0.1:6300',
    faucet: defaults.faucet,
  };
};

/** CLI flag wins, then midnight/.env, then the default. */
export const resolveNetwork = (flag: string | undefined): string =>
  flag ?? env('NIGHTPASS_NETWORK') ?? 'preview';
