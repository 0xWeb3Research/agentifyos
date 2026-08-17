import type { Nightpass, NightpassPrivateState } from '@nightpass/contract';
import type { MidnightProviders } from '@midnight-ntwrk/midnight-js/types';
import type { DeployedContract, FoundContract } from '@midnight-ntwrk/midnight-js/contracts';
import type { ProvableCircuitId } from '@midnight-ntwrk/compact-js';

export type NightpassCircuits = ProvableCircuitId<Nightpass.Contract<NightpassPrivateState>>;

export const NightpassPrivateStateId = 'nightpassPrivateState';

export type NightpassProviders = MidnightProviders<
  NightpassCircuits,
  typeof NightpassPrivateStateId,
  NightpassPrivateState
>;

export type NightpassContract = Nightpass.Contract<NightpassPrivateState>;

export type DeployedNightpassContract =
  | DeployedContract<NightpassContract>
  | FoundContract<NightpassContract>;
