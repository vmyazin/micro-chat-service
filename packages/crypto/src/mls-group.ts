import type { GroupId } from '@microchat/shared';
import type { GroupCipher } from './group-cipher';
import type { Commit, GroupContext, Welcome } from './mls-commit';
import type {
  AddProposal,
  Proposal,
  RemoveProposal,
  SerializedKeyPackage,
  UpdateProposal,
} from './mls-proposals';
import {
  advanceTranscriptHash,
  computeTreeHash,
  initialTranscriptHash,
} from './mls-transcript';
import { TreeKEM } from './treekem';
import {
  deserializeTree,
  deserializeUpdatePath,
  serializeTree,
  serializeUpdatePath,
} from './treekem-serialization';
import type {
  ECKeyPair,
  KeyPackage,
  LeafIndex,
  UpdatePath,
} from './treekem-types';

export class MLSGroupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MLSGroupError';
  }
}

/**
 * MLS-shaped state machine wrapping TreeKEM.
 *
 * Provides Proposals, Commits, Welcome messages, and transcript hashing
 * on top of the existing TreeKEM protocol implementation.
 */
export class MLSGroup {
  private treekem: TreeKEM;
  private groupId: GroupId;
  private epoch: number;
  private transcriptHash: string;
  private myLeafIndex: LeafIndex;
  private cipher: GroupCipher;

  private constructor(
    treekem: TreeKEM,
    groupId: GroupId,
    epoch: number,
    transcriptHash: string,
    myLeafIndex: LeafIndex,
    cipher: GroupCipher,
  ) {
    this.treekem = treekem;
    this.groupId = groupId;
    this.epoch = epoch;
    this.transcriptHash = transcriptHash;
    this.myLeafIndex = myLeafIndex;
    this.cipher = cipher;
  }

  /**
   * Create a new group. The creator is leaf 0.
   * Returns the MLSGroup and the initial Commit that establishes epoch 1.
   */
  static async create(
    groupId: GroupId,
    myKeyPair: ECKeyPair,
    myCredential: Uint8Array,
    cipher: GroupCipher,
  ): Promise<{ group: MLSGroup; commit: Commit }> {
    const { treekem, updatePath } = await TreeKEM.createGroup(
      myKeyPair,
      myCredential,
      [],
    );

    const prevHash = initialTranscriptHash();
    const proposals: Proposal[] = [];
    const committer = 0;

    const newTranscriptHash = await advanceTranscriptHash(prevHash, {
      proposals,
      committer,
    });

    const serializedUpdatePath = await serializeUpdatePath(updatePath);
    const treeData = await serializeTree(treekem.getTree());

    const epoch = 0;
    const newEpoch = 1;

    // Derive group key for epoch 1
    const groupSecret = await treekem.deriveGroupSecret();
    debugTreeKEM(
      'create',
      `group=${groupId} epoch=${newEpoch} secret=${shortDigest(groupSecret)}`,
    );
    await cipher.deriveGroupKey(groupId, newEpoch, groupSecret);

    const commit: Commit = {
      epoch,
      newEpoch,
      proposals,
      updatePath: serializedUpdatePath,
      treeData,
      transcriptHash: newTranscriptHash,
      committer,
    };

    const group = new MLSGroup(
      treekem,
      groupId,
      newEpoch,
      newTranscriptHash,
      0,
      cipher,
    );

    return { group, commit };
  }

  /**
   * Restore group state from persisted tree data (no Welcome needed).
   *
   * Used when the in-memory MLSGroup is lost (e.g. hot reload) but the epoch
   * key is already stored in the KeyStore (IndexedDB). This avoids calling
   * deriveGroupKey again — the key was already derived during the original
   * commit and is still accessible via the cipher's KeyStore.
   *
   * @param transcriptHash - transcript hash after the last commit (from commit.transcriptHash).
   *   Pass empty string only as a last resort; an incorrect hash will cause
   *   processCommit to fail on the next commit.
   */
  static async fromTreeData(
    groupId: GroupId,
    treeData: string,
    epoch: number,
    transcriptHash: string,
    myLeafIndex: LeafIndex,
    myKeyPair: ECKeyPair,
    cipher: GroupCipher,
  ): Promise<MLSGroup> {
    const tree = await deserializeTree(treeData);

    // Inject our private key at our leaf position
    const nodeIndex = myLeafIndex * 2;
    const leafNode = tree.nodes[nodeIndex];
    if (leafNode && leafNode.type === 'leaf') {
      leafNode.keyPair = myKeyPair;
    }

    const treekem = new TreeKEM(tree, myLeafIndex);

    // Do NOT call cipher.deriveGroupKey — the key was already derived and
    // stored in the KeyStore during the original create/joinFromWelcome/commit.
    return new MLSGroup(treekem, groupId, epoch, transcriptHash, myLeafIndex, cipher);
  }

  /**
   * Join a group from a Welcome message.
   * Reconstructs the tree state and processes the commit's UpdatePath.
   */
  static async joinFromWelcome(
    welcome: Welcome,
    myKeyPair: ECKeyPair,
    cipher: GroupCipher,
  ): Promise<MLSGroup> {
    const tree = await deserializeTree(welcome.treeData);

    // Inject our private key at our leaf
    const nodeIndex = welcome.leafIndex * 2;
    const leafNode = tree.nodes[nodeIndex];
    if (leafNode && leafNode.type === 'leaf') {
      leafNode.keyPair = myKeyPair;
    }

    const treekem = new TreeKEM(tree, welcome.leafIndex);

    // Process the commit's UpdatePath to derive shared secrets
    const updatePath = await deserializeUpdatePath(welcome.commit.updatePath);
    await treekem.processUpdatePath(updatePath);

    // Derive group key
    const groupSecret = await treekem.deriveGroupSecret();
    const groupId = welcome.groupId as GroupId;
    debugTreeKEM(
      'joinFromWelcome',
      `group=${groupId} epoch=${welcome.epoch} secret=${shortDigest(groupSecret)}`,
    );
    await cipher.deriveGroupKey(groupId, welcome.epoch, groupSecret);

    return new MLSGroup(
      treekem,
      groupId,
      welcome.epoch,
      welcome.groupContext.transcriptHash,
      welcome.leafIndex,
      cipher,
    );
  }

  // --- Proposal factories ---

  proposeAdd(keyPackage: SerializedKeyPackage): AddProposal {
    return { type: 'add', keyPackage };
  }

  proposeRemove(leafIndex: number): RemoveProposal {
    return { type: 'remove', removedLeafIndex: leafIndex };
  }

  proposeUpdate(): UpdateProposal {
    return { type: 'update' };
  }

  // --- Commit ---

  /**
   * Create a Commit applying the given proposals.
   * The caller must be the committer. Returns a Commit and optionally
   * a Welcome for each AddProposal.
   */
  async commit(proposals: Proposal[]): Promise<{
    commit: Commit;
    welcome?: Welcome;
  }> {
    const newEpoch = this.epoch + 1;
    let addedLeafIndex: LeafIndex | undefined;
    let updatePath: UpdatePath | null = null;

    // Apply proposals in order
    for (const proposal of proposals) {
      switch (proposal.type) {
        case 'add': {
          const keyPackage = await this.deserializeKeyPackage(
            proposal.keyPackage,
          );
          const result = await this.treekem.addMember(keyPackage);
          updatePath = result.updatePath;
          const { newLeafIndex } = result;
          addedLeafIndex = newLeafIndex;
          break;
        }
        case 'remove':
          this.treekem.removeMember(proposal.removedLeafIndex);
          // After removal, committer must do an update to refresh path
          updatePath = await this.treekem.update();
          break;
        case 'update':
          updatePath = await this.treekem.update();
          break;
      }
    }

    // Commits must carry exactly one final UpdatePath for the resulting tree state.
    // addMember() already performs update internally; other proposal types capture
    // their own update above.
    if (!updatePath) {
      updatePath = await this.treekem.update();
    }

    // Serialize the final state
    const serializedUpdatePath = await serializeUpdatePath(updatePath);
    const treeData = await serializeTree(this.treekem.getTree());

    // Advance transcript hash
    const newTranscriptHash = await advanceTranscriptHash(this.transcriptHash, {
      proposals,
      committer: this.myLeafIndex,
    });

    // Derive group key for new epoch
    const groupSecret = await this.treekem.deriveGroupSecret();
    debugTreeKEM(
      'commit',
      `group=${this.groupId} epoch=${newEpoch} secret=${shortDigest(groupSecret)}`,
    );
    await this.cipher.deriveGroupKey(this.groupId, newEpoch, groupSecret);

    const commit: Commit = {
      epoch: this.epoch,
      newEpoch,
      proposals,
      updatePath: serializedUpdatePath,
      treeData,
      transcriptHash: newTranscriptHash,
      committer: this.myLeafIndex,
    };

    // Advance local state
    this.epoch = newEpoch;
    this.transcriptHash = newTranscriptHash;

    // Build Welcome if there was an AddProposal
    let welcome: Welcome | undefined;
    const hasAdd = proposals.some((p) => p.type === 'add');
    if (hasAdd && addedLeafIndex !== undefined) {
      const treeHash = await computeTreeHash(treeData);
      const groupContext: GroupContext = {
        groupId: this.groupId,
        epoch: newEpoch,
        treeHash,
        transcriptHash: newTranscriptHash,
      };
      welcome = {
        groupId: this.groupId,
        epoch: newEpoch,
        treeData,
        commit,
        leafIndex: addedLeafIndex,
        groupContext,
      };
    }

    return { commit, welcome };
  }

  /**
   * Process an incoming Commit from another member.
   * Verifies epoch, transcript hash, applies proposals, and advances state.
   */
  async processCommit(commit: Commit): Promise<void> {
    // Verify epoch
    if (commit.epoch !== this.epoch) {
      throw new MLSGroupError(
        `Epoch mismatch: commit is from epoch ${commit.epoch}, but we are at epoch ${this.epoch}`,
      );
    }

    // Verify transcript hash
    const expectedHash = await advanceTranscriptHash(this.transcriptHash, {
      proposals: commit.proposals,
      committer: commit.committer,
    });
    if (commit.transcriptHash !== expectedHash) {
      throw new MLSGroupError(
        'Transcript hash verification failed: commit may be tampered or out of order',
      );
    }

    // Apply proposals in order
    for (const proposal of commit.proposals) {
      switch (proposal.type) {
        case 'add': {
          const keyPackage = await this.deserializeKeyPackage(
            proposal.keyPackage,
          );
          // Place the new member in the tree (without doing an update — the
          // committer's UpdatePath already includes the update)
          this.placeNewMember(keyPackage);
          break;
        }
        case 'remove':
          this.treekem.removeMember(proposal.removedLeafIndex);
          break;
        case 'update':
          // The committer updated their key — handled via processUpdatePath below
          break;
      }
    }

    // Process the committer's UpdatePath
    const updatePath = await deserializeUpdatePath(commit.updatePath);
    await this.treekem.processUpdatePath(updatePath);

    // Derive group key for new epoch
    const groupSecret = await this.treekem.deriveGroupSecret();
    debugTreeKEM(
      'processCommit',
      `group=${this.groupId} epoch=${commit.newEpoch} secret=${shortDigest(groupSecret)}`,
    );
    await this.cipher.deriveGroupKey(
      this.groupId,
      commit.newEpoch,
      groupSecret,
    );

    // Advance local state
    this.epoch = commit.newEpoch;
    this.transcriptHash = commit.transcriptHash;
  }

  // --- Accessors ---

  getContext(): GroupContext {
    return {
      groupId: this.groupId,
      epoch: this.epoch,
      // Tree hash is computed lazily — use empty string as placeholder
      // since computing it requires async. Use getContextAsync() for full context.
      treeHash: '',
      transcriptHash: this.transcriptHash,
    };
  }

  async getContextAsync(): Promise<GroupContext> {
    const treeData = await serializeTree(this.treekem.getTree());
    const treeHash = await computeTreeHash(treeData);
    return {
      groupId: this.groupId,
      epoch: this.epoch,
      treeHash,
      transcriptHash: this.transcriptHash,
    };
  }

  getEpoch(): number {
    return this.epoch;
  }

  getTranscriptHash(): string {
    return this.transcriptHash;
  }

  getMyLeafIndex(): LeafIndex {
    return this.myLeafIndex;
  }

  getTreeKEM(): TreeKEM {
    return this.treekem;
  }

  // --- Private helpers ---

  private async deserializeKeyPackage(
    serialized: SerializedKeyPackage,
  ): Promise<KeyPackage> {
    const pubKeyBytes = base64ToUint8(serialized.publicKey);
    const publicKey = await crypto.subtle.importKey(
      'raw',
      pubKeyBytes.buffer as ArrayBuffer,
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      [],
    );
    return {
      publicKey,
      credential: base64ToUint8(serialized.credential),
    };
  }

  /**
   * Place a new member into the tree at the first blank leaf or by extending.
   * This is the non-updating variant used by processCommit (the committer's
   * UpdatePath handles the path refresh).
   */
  private placeNewMember(keyPackage: KeyPackage): LeafIndex {
    const tree = this.treekem.getTree();
    let newLeafIndex: LeafIndex | null = null;

    // Find first blank leaf
    for (let i = 0; i < tree.numLeaves; i++) {
      const nodeIndex = i * 2;
      const node = tree.nodes[nodeIndex];
      if (
        !node ||
        (node.type === 'leaf' &&
          node.keyPair === null &&
          node.credential === null)
      ) {
        newLeafIndex = i;
        break;
      }
    }

    if (newLeafIndex === null) {
      // Extend the tree
      newLeafIndex = tree.numLeaves;
      tree.numLeaves++;
      const treeSize = 2 * tree.numLeaves - 1;
      while (tree.nodes.length < treeSize) {
        const idx = tree.nodes.length;
        if (idx % 2 === 1) {
          tree.nodes.push({
            type: 'parent',
            index: idx,
            keyPair: null,
            pathSecret: null,
            unmergedLeaves: [],
          });
        } else {
          tree.nodes.push(null);
        }
      }
    }

    const nodeIndex = newLeafIndex * 2;
    tree.nodes[nodeIndex] = {
      type: 'leaf',
      index: newLeafIndex,
      keyPair: {
        publicKey: keyPackage.publicKey,
        privateKey: null as unknown as CryptoKey,
      },
      credential: keyPackage.credential,
    };

    return newLeafIndex;
  }
}

// --- Base64 helpers (duplicated from treekem-serialization to avoid circular deps) ---

function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

const TREEKEM_DEBUG_FLAG = '__MICROCHAT_DEBUG_TREEKEM__';

function isTreeKEMDebugEnabled(): boolean {
  return (
    typeof globalThis !== 'undefined' &&
    Boolean((globalThis as Record<string, unknown>)[TREEKEM_DEBUG_FLAG])
  );
}

function debugTreeKEM(scope: string, message: string): void {
  if (!isTreeKEMDebugEnabled()) return;
  console.debug(`[TreeKEM][MLSGroup:${scope}] ${message}`);
}

function shortDigest(secret: Uint8Array): string {
  let hash = 0;
  for (const byte of secret) {
    hash = (hash * 31 + byte) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
