import type { Proposal } from './mls-proposals';

export interface Commit {
  /** Epoch this commit transitions FROM */
  epoch: number;
  /** Epoch this commit transitions TO */
  newEpoch: number;
  /** Proposals applied in this commit */
  proposals: Proposal[];
  /** Serialized UpdatePath (from treekem-serialization) */
  updatePath: string;
  /** Serialized tree state after applying all proposals */
  treeData: string;
  /** H(prevTranscriptHash || commitContent) — hex-encoded SHA-256 */
  transcriptHash: string;
  /** Leaf index of the member who created this commit */
  committer: number;
}

export interface Welcome {
  groupId: string;
  epoch: number;
  treeData: string;
  commit: Commit;
  /** Leaf index assigned to the new member */
  leafIndex: number;
  groupContext: GroupContext;
}

export interface GroupContext {
  groupId: string;
  epoch: number;
  /** SHA-256 of the serialized tree — hex-encoded */
  treeHash: string;
  /** Current transcript hash — hex-encoded */
  transcriptHash: string;
}
