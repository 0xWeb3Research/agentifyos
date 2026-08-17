/*
 * An in-process testbed for the Nightpass contract.
 *
 * It runs the real compiled circuits against a real ledger, so every assertion
 * the contract makes is genuinely enforced here. What it skips is proof
 * generation, which is what makes it fast enough to assert privacy properties
 * exhaustively rather than once.
 */

import {
  type CircuitContext,
  QueryContext,
  sampleContractAddress,
  createConstructorContext,
  CostModel,
} from '@midnight-ntwrk/compact-runtime';
import {
  Contract,
  type Ledger,
  ledger,
  pureCircuits,
} from '../managed/nightpass/contract/index.js';
import {
  type NightpassPrivateState,
  createNightpassPrivateState,
  withCallSpent,
  withPass,
  witnesses,
} from '../witnesses.js';

export class NightpassSimulator {
  readonly contract: Contract<NightpassPrivateState>;
  circuitContext: CircuitContext<NightpassPrivateState>;

  constructor(secretKey: Uint8Array) {
    this.contract = new Contract<NightpassPrivateState>(witnesses);
    const { currentPrivateState, currentContractState, currentZswapLocalState } =
      this.contract.initialState(
        createConstructorContext(createNightpassPrivateState(secretKey), '0'.repeat(64)),
      );
    this.circuitContext = {
      currentPrivateState,
      currentZswapLocalState,
      costModel: CostModel.initialCostModel(),
      currentQueryContext: new QueryContext(currentContractState.data, sampleContractAddress()),
    };
  }

  /** Act as a different party against the same shared ledger. */
  public as(state: NightpassPrivateState): this {
    this.circuitContext.currentPrivateState = state;
    return this;
  }

  public get privateState(): NightpassPrivateState {
    return this.circuitContext.currentPrivateState;
  }

  public ledger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public registerTool(toolId: Uint8Array, priceAtomic: bigint, quota: bigint): void {
    this.circuitContext = this.contract.impureCircuits.registerTool(
      this.circuitContext,
      toolId,
      priceAtomic,
      quota,
    ).context;
  }

  public setToolActive(toolId: Uint8Array, active: boolean): void {
    this.circuitContext = this.contract.impureCircuits.setToolActive(
      this.circuitContext,
      toolId,
      active,
    ).context;
  }

  /** Buys a pass and records its secret locally, exactly as the real client does. */
  public issuePass(toolId: Uint8Array, nonce: Uint8Array): Uint8Array {
    this.circuitContext.currentPrivateState = withPass(
      this.circuitContext.currentPrivateState,
      toolId,
      nonce,
    );
    const { context, result } = this.contract.impureCircuits.issuePass(this.circuitContext, toolId);
    this.circuitContext = context;
    return result;
  }

  /** Spends one call and advances the local counter, as the real client does. */
  public redeemCall(toolId: Uint8Array): Uint8Array {
    const { context, result } = this.contract.impureCircuits.redeemCall(this.circuitContext, toolId);
    this.circuitContext = context;
    this.circuitContext.currentPrivateState = withCallSpent(
      this.circuitContext.currentPrivateState,
      toolId,
    );
    return result;
  }

  /**
   * Rewinds only the caller's local bookkeeping, leaving the ledger untouched.
   * That is exactly the state an attacker is in when replaying a call: it can
   * rewind its own machine, but not the chain's record of what it spent.
   */
  public rewindLocalCounter(state: NightpassPrivateState): void {
    this.circuitContext.currentPrivateState = state;
  }

  public attestUsage(toolId: Uint8Array, auditorId: Uint8Array, callsClaimed: bigint): Uint8Array {
    const { context, result } = this.contract.impureCircuits.attestUsage(
      this.circuitContext,
      toolId,
      auditorId,
      callsClaimed,
    );
    this.circuitContext = context;
    return result;
  }

  /**
   * The derivations, callable with plain arguments and no contract context.
   * This is the surface an auditor uses to check an attestation by hand.
   */
  public get pure(): typeof pureCircuits {
    return pureCircuits;
  }
}
