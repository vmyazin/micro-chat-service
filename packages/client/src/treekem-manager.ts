import type { GroupCipher } from '@microchat/crypto';
import {
  type Commit,
  type ECKeyPair,
  type GroupContext,
  type KeyPackage,
  type LeafIndex,
  MLSGroup,
  type SerializedKeyPackage,
  type Welcome,
} from '@microchat/crypto';
import type { GroupId } from '@microchat/shared';

export interface SerializedCommitUpdate {
  commit: string;
  welcome?: string;
  epoch: number;
}

/** @deprecated Use SerializedCommitUpdate instead */
export interface SerializedUpdate {
  updatePath: string;
  treeData: string;
  epoch: number;
}

export class TreeKEMManager {
  private groups: Map<string, MLSGroup> = new Map();

  constructor(private readonly cipher: GroupCipher) {}

  /**
   * Initialize tree for a newly created group (creator is leaf 0).
   * Returns a serialized Commit for posting to the server.
   */
  async initGroup(
    groupId: GroupId,
    myKeyPair: ECKeyPair,
    myCredential: Uint8Array,
    _otherMembers: KeyPackage[],
  ): Promise<SerializedCommitUpdate> {
    // MLSGroup.create handles TreeKEM creation and key derivation
    const { group, commit } = await MLSGroup.create(
      groupId,
      myKeyPair,
      myCredential,
      this.cipher,
    );

    this.groups.set(groupId, group);

    return {
      commit: JSON.stringify(commit),
      epoch: group.getEpoch(),
    };
  }

  /**
   * Join an existing group using a Welcome message.
   */
  async joinFromWelcome(
    groupId: GroupId,
    welcomeJson: string,
    myKeyPair: ECKeyPair,
  ): Promise<void> {
    const welcome: Welcome = JSON.parse(welcomeJson);
    const group = await MLSGroup.joinFromWelcome(
      welcome,
      myKeyPair,
      this.cipher,
    );
    this.groups.set(groupId, group);
  }

  /**
   * Join an existing group using the current tree state (legacy path).
   * Used when no Welcome message is available (e.g., reconnecting).
   * When commitJson is provided, reconstructs a real Welcome from the server-persisted
   * Commit instead of falling back to the synthetic epoch-0 path.
   */
  async joinGroup(
    groupId: GroupId,
    treeDataJson: string,
    myLeafIndex: LeafIndex,
    myKeyPair: ECKeyPair,
    commitJson?: string,   // When present: use real Welcome reconstruction instead of synthetic path
  ): Promise<void> {
    if (commitJson) {
      // Real recovery path: reconstruct Welcome from server-persisted Commit.
      // Falls through to synthetic path if the commit's update path doesn't include
      // this member (e.g. the server's latest commit was for a different member, or
      // the user regenerated their identity key).
      try {
        const commit: Commit = JSON.parse(commitJson);
        const welcome: Welcome = {
          groupId,
          epoch: commit.newEpoch,
          treeData: treeDataJson,
          commit,
          leafIndex: myLeafIndex,
          groupContext: {
            groupId,
            epoch: commit.newEpoch,
            treeHash: '',
            transcriptHash: commit.transcriptHash,
          },
        };
        const group = await MLSGroup.joinFromWelcome(welcome, myKeyPair, this.cipher);
        this.groups.set(groupId, group);
        return;
      } catch {
        // Commit reconstruction failed — fall through to synthetic epoch-0 join.
        // The caller can detect this via getEpoch() === 0 and prompt for re-invite.
      }
    }

    // Build a synthetic Welcome for backward compatibility
    const welcome: Welcome = {
      groupId,
      epoch: 0, // Will be updated on first processCommit
      treeData: treeDataJson,
      commit: {
        epoch: 0,
        newEpoch: 0,
        proposals: [],
        updatePath:
          '{"sender":0,"pathPublicKeys":[],"encryptedPathSecrets":[]}',
        treeData: treeDataJson,
        transcriptHash: '',
        committer: 0,
      },
      leafIndex: myLeafIndex,
      groupContext: {
        groupId,
        epoch: 0,
        treeHash: '',
        transcriptHash: '',
      },
    };

    // For the legacy path, we need to create the MLSGroup differently
    // since there's no valid commit to process. We'll use the tree directly.
    const { deserializeTree } = await import('@microchat/crypto');

    const tree = await deserializeTree(treeDataJson);

    // Insert our full key pair at our leaf position
    const nodeIndex = myLeafIndex * 2;
    const leafNode = tree.nodes[nodeIndex];
    if (leafNode && leafNode.type === 'leaf') {
      leafNode.keyPair = myKeyPair;
    }

    // Create a minimal MLSGroup by joining with a synthetic welcome
    // that has the tree data but empty commit (no path processing needed)
    const group = await MLSGroup.joinFromWelcome(
      {
        ...welcome,
        commit: {
          ...welcome.commit,
          // Empty update path — no path secrets to process for legacy join
          updatePath:
            '{"sender":0,"pathPublicKeys":[],"encryptedPathSecrets":[]}',
        },
      },
      myKeyPair,
      this.cipher,
    );

    this.groups.set(groupId, group);
  }

  /**
   * Process an incoming commit from another member.
   */
  async processCommit(groupId: GroupId, commitJson: string): Promise<void> {
    const group = this.groups.get(groupId);
    if (!group) {
      throw new Error(`No MLS group state for group ${groupId}`);
    }

    const commit: Commit = JSON.parse(commitJson);
    await group.processCommit(commit);
  }

  /**
   * @deprecated Use processCommit instead
   * Process an incoming tree update (legacy path for backward compat).
   */
  async processUpdate(
    groupId: GroupId,
    serializedUpdatePath: string,
    newEpoch: number,
  ): Promise<void> {
    const group = this.groups.get(groupId);
    if (!group) {
      throw new Error(`No MLS group state for group ${groupId}`);
    }

    // For legacy updates, we process the update path directly on the
    // underlying TreeKEM since we don't have valid transcript hashes
    const { deserializeUpdatePath } = await import('@microchat/crypto');

    const updatePath = await deserializeUpdatePath(serializedUpdatePath);
    await group.getTreeKEM().processUpdatePath(updatePath);

    // Derive the new group key
    const groupSecret = await group.getTreeKEM().deriveGroupSecret();
    await this.cipher.deriveGroupKey(groupId, newEpoch, groupSecret);
  }

  /**
   * Get the current epoch for a group.
   */
  getEpoch(groupId: GroupId): number {
    const group = this.groups.get(groupId);
    return group?.getEpoch() ?? 0;
  }

  /**
   * Trigger a key update (PCS healing or routine rotation).
   */
  async update(groupId: GroupId): Promise<SerializedCommitUpdate> {
    const group = this.groups.get(groupId);
    if (!group) {
      throw new Error(`No MLS group state for group ${groupId}`);
    }

    const { commit } = await group.commit([group.proposeUpdate()]);

    return {
      commit: JSON.stringify(commit),
      epoch: group.getEpoch(),
    };
  }

  /**
   * Handle member addition — creates AddProposal + Commit.
   */
  async addMember(
    groupId: GroupId,
    newMemberKeyPackage: KeyPackage,
  ): Promise<SerializedCommitUpdate & { newLeafIndex: LeafIndex }> {
    const group = this.groups.get(groupId);
    if (!group) {
      throw new Error(`No MLS group state for group ${groupId}`);
    }

    // Serialize the KeyPackage for the AddProposal
    const pubRaw = new Uint8Array(
      await crypto.subtle.exportKey('raw', newMemberKeyPackage.publicKey),
    );
    const serializedKP: SerializedKeyPackage = {
      publicKey: uint8ToBase64(pubRaw),
      credential: uint8ToBase64(newMemberKeyPackage.credential),
    };

    const addProposal = group.proposeAdd(serializedKP);
    const { commit, welcome } = await group.commit([addProposal]);

    return {
      commit: JSON.stringify(commit),
      welcome: welcome ? JSON.stringify(welcome) : undefined,
      epoch: group.getEpoch(),
      newLeafIndex: welcome?.leafIndex ?? 0,
    };
  }

  /**
   * Handle member removal — creates RemoveProposal + Commit.
   */
  async removeMember(
    groupId: GroupId,
    leafIndex: LeafIndex,
  ): Promise<SerializedCommitUpdate> {
    const group = this.groups.get(groupId);
    if (!group) {
      throw new Error(`No MLS group state for group ${groupId}`);
    }

    const removeProposal = group.proposeRemove(leafIndex);
    const { commit } = await group.commit([removeProposal]);

    return {
      commit: JSON.stringify(commit),
      epoch: group.getEpoch(),
    };
  }

  /**
   * Get GroupContext for a group.
   */
  getContext(groupId: GroupId): GroupContext | undefined {
    const group = this.groups.get(groupId);
    return group?.getContext();
  }

  /**
   * Check if a group has an initialized tree.
   */
  hasTree(groupId: GroupId): boolean {
    return this.groups.has(groupId);
  }

  /**
   * Clear in-memory tree state for a group without deleting IndexedDB keys.
   * Use before re-joining so that historical epoch keys are preserved in case
   * the re-join fails — old messages can still be decrypted with the saved keys.
   * After calling this, hasTree() returns false and joinGroupTree() will proceed.
   */
  clearTree(groupId: GroupId): void {
    this.groups.delete(groupId);
  }

  /**
   * Remove all local tree state for a group.
   * Clears the in-memory MLSGroup entry and all derived epoch keys from the key store.
   * Call before re-joining via joinGroupTree to reset diverged local state.
   * Must be awaited — key deletion is async (IndexedDB).
   */
  async deleteGroup(groupId: GroupId): Promise<void> {
    this.groups.delete(groupId);              // Synchronous: hasTree() returns false immediately
    await this.cipher.deleteAllGroupKeys(groupId);
  }

  /**
   * Get the tree for a group (for inspection/debugging).
   */
  getTree(groupId: GroupId) {
    return this.groups.get(groupId)?.getTreeKEM().getTree();
  }
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
