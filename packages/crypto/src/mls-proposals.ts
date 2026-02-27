export type ProposalType = 'add' | 'remove' | 'update';

/**
 * Serialized key package for JSON transport.
 * Uses base64-encoded raw ECDH public key + credential,
 * matching the format from treekem-serialization.ts.
 */
export interface SerializedKeyPackage {
  publicKey: string; // base64 raw ECDH public key
  credential: string; // base64 credential
}

export interface AddProposal {
  type: 'add';
  keyPackage: SerializedKeyPackage;
}

export interface RemoveProposal {
  type: 'remove';
  removedLeafIndex: number;
}

export interface UpdateProposal {
  type: 'update';
  // Sender updates their own leaf key (PCS healing).
  // No additional data needed — the committer's new key
  // is provided via the Commit's updatePath.
}

export type Proposal = AddProposal | RemoveProposal | UpdateProposal;
