/** Node index in the flat array representation of a left-balanced binary tree. */
export type NodeIndex = number;

/** Leaf index: the member's position (0-based). Leaf i sits at NodeIndex 2*i. */
export type LeafIndex = number;

export interface ECKeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

export interface LeafNode {
  type: 'leaf';
  index: LeafIndex;
  /** Null if the leaf is blanked (member removed). */
  keyPair: ECKeyPair | null;
  /** Opaque credential for the member (e.g. public key bytes). */
  credential: Uint8Array | null;
}

export interface ParentNode {
  type: 'parent';
  index: NodeIndex;
  /** Null if blanked. */
  keyPair: ECKeyPair | null;
  /** The path secret from which this node's key pair was derived. */
  pathSecret: Uint8Array | null;
  /** Leaf indices that haven't received this node's secret yet. */
  unmergedLeaves: LeafIndex[];
}

export type TreeNode = LeafNode | ParentNode;

export interface RatchetTree {
  /** Flat array of nodes. Length = 2*numLeaves - 1. Even indices = leaves, odd = parents. */
  nodes: (TreeNode | null)[];
  /** Number of leaf slots (including blanks). */
  numLeaves: number;
}

/** A KeyPackage bundles a member's initial ECDH public key + credential. */
export interface KeyPackage {
  publicKey: CryptoKey;
  credential: Uint8Array;
}

/** An UpdatePath is broadcast after an update/add/remove. */
export interface UpdatePath {
  /** The sender's leaf index. */
  sender: LeafIndex;
  /** New public keys for each node on the direct path (leaf to root, inclusive of leaf). */
  pathPublicKeys: CryptoKey[];
  /** For each node on the direct path, the path secret encrypted to the resolution of the copath node. */
  encryptedPathSecrets: EncryptedPathSecret[][];
}

/** A single encrypted path secret targeted at one node in a sibling resolution. */
export interface EncryptedPathSecret {
  /** The NodeIndex of the target (recipient) node. */
  targetNode: NodeIndex;
  /** AES-GCM ciphertext wrapping the path secret. */
  ciphertext: Uint8Array;
  /** The ephemeral ECDH public key used for key agreement. */
  ephemeralPublicKey: CryptoKey;
  /** AES-GCM nonce (12 bytes). */
  nonce: Uint8Array;
}
