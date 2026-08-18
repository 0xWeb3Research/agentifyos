import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type ToolRecord = { publisherCommitment: Uint8Array;
                           priceAtomic: bigint;
                           quota: bigint;
                           active: boolean
                         };

export type Witnesses<PS> = {
  secretKey(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  passNonce(context: __compactRuntime.WitnessContext<Ledger, PS>,
            toolId_0: Uint8Array): [PS, Uint8Array];
  callIndex(context: __compactRuntime.WitnessContext<Ledger, PS>,
            toolId_0: Uint8Array): [PS, bigint];
  passPath(context: __compactRuntime.WitnessContext<Ledger, PS>,
           commitment_0: Uint8Array): [PS, { leaf: Uint8Array,
                                             path: { sibling: { field: bigint },
                                                     goes_left: boolean
                                                   }[]
                                           }];
}

export type ImpureCircuits<PS> = {
  registerTool(context: __compactRuntime.CircuitContext<PS>,
               toolId_0: Uint8Array,
               priceAtomic_0: bigint,
               quota_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  setToolActive(context: __compactRuntime.CircuitContext<PS>,
                toolId_0: Uint8Array,
                active_0: boolean): __compactRuntime.CircuitResults<PS, []>;
  issuePass(context: __compactRuntime.CircuitContext<PS>, toolId_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  redeemCall(context: __compactRuntime.CircuitContext<PS>, toolId_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  attestUsage(context: __compactRuntime.CircuitContext<PS>,
              toolId_0: Uint8Array,
              auditorId_0: Uint8Array,
              callsClaimed_0: bigint): __compactRuntime.CircuitResults<PS, Uint8Array>;
}

export type ProvableCircuits<PS> = {
  registerTool(context: __compactRuntime.CircuitContext<PS>,
               toolId_0: Uint8Array,
               priceAtomic_0: bigint,
               quota_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  setToolActive(context: __compactRuntime.CircuitContext<PS>,
                toolId_0: Uint8Array,
                active_0: boolean): __compactRuntime.CircuitResults<PS, []>;
  issuePass(context: __compactRuntime.CircuitContext<PS>, toolId_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  redeemCall(context: __compactRuntime.CircuitContext<PS>, toolId_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  attestUsage(context: __compactRuntime.CircuitContext<PS>,
              toolId_0: Uint8Array,
              auditorId_0: Uint8Array,
              callsClaimed_0: bigint): __compactRuntime.CircuitResults<PS, Uint8Array>;
}

export type PureCircuits = {
  publisherCommitment(sk_0: Uint8Array): Uint8Array;
  passCommitment(toolId_0: Uint8Array, sk_0: Uint8Array, nonce_0: Uint8Array): Uint8Array;
  callNullifier(commitment_0: Uint8Array, index_0: bigint): Uint8Array;
  auditTag(auditorId_0: Uint8Array,
           commitment_0: Uint8Array,
           callsClaimed_0: bigint): Uint8Array;
}

export type Circuits<PS> = {
  publisherCommitment(context: __compactRuntime.CircuitContext<PS>,
                      sk_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  passCommitment(context: __compactRuntime.CircuitContext<PS>,
                 toolId_0: Uint8Array,
                 sk_0: Uint8Array,
                 nonce_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  callNullifier(context: __compactRuntime.CircuitContext<PS>,
                commitment_0: Uint8Array,
                index_0: bigint): __compactRuntime.CircuitResults<PS, Uint8Array>;
  auditTag(context: __compactRuntime.CircuitContext<PS>,
           auditorId_0: Uint8Array,
           commitment_0: Uint8Array,
           callsClaimed_0: bigint): __compactRuntime.CircuitResults<PS, Uint8Array>;
  registerTool(context: __compactRuntime.CircuitContext<PS>,
               toolId_0: Uint8Array,
               priceAtomic_0: bigint,
               quota_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  setToolActive(context: __compactRuntime.CircuitContext<PS>,
                toolId_0: Uint8Array,
                active_0: boolean): __compactRuntime.CircuitResults<PS, []>;
  issuePass(context: __compactRuntime.CircuitContext<PS>, toolId_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  redeemCall(context: __compactRuntime.CircuitContext<PS>, toolId_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  attestUsage(context: __compactRuntime.CircuitContext<PS>,
              toolId_0: Uint8Array,
              auditorId_0: Uint8Array,
              callsClaimed_0: bigint): __compactRuntime.CircuitResults<PS, Uint8Array>;
}

export type Ledger = {
  tools: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): ToolRecord;
    [Symbol.iterator](): Iterator<[Uint8Array, ToolRecord]>
  };
  passCommitments: {
    isFull(): boolean;
    checkRoot(rt_0: { field: bigint }): boolean;
    root(): __compactRuntime.MerkleTreeDigest;
    firstFree(): bigint;
    pathForLeaf(index_0: bigint, leaf_0: Uint8Array): __compactRuntime.MerkleTreePath<Uint8Array>;
    findPathForLeaf(leaf_0: Uint8Array): __compactRuntime.MerkleTreePath<Uint8Array> | undefined;
    history(): Iterator<__compactRuntime.MerkleTreeDigest>
  };
  spentCalls: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  callsServed: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, bigint]>
  };
  readonly passesIssued: bigint;
  attestations: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Uint8Array;
    [Symbol.iterator](): Iterator<[Uint8Array, Uint8Array]>
  };
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
