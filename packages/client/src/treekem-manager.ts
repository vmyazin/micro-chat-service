import type { GroupCipher } from '@microchat/crypto';
import {
  TreeKEM,
  type ECKeyPair,
  type KeyPackage,
  type LeafIndex,
  type RatchetTree,
  serializeTree,
  serializeUpdatePath,
  deserializeTree,
  deserializeUpdatePath,
} from '@microchat/crypto';
import type { GroupId } from '@microchat/shared';

export interface SerializedUpdate {
  updatePath: string;
  treeData: string;
  epoch: number;
}

export class TreeKEMManager {
  private trees: Map<string, TreeKEM> = new Map();
  private epochs: Map<string, number> = new Map();

  constructor(private readonly cipher: GroupCipher) {}

  /**
   * Initialize tree for a newly created group (creator is leaf 0).
   */
  async initGroup(
    groupId: GroupId,
    myKeyPair: ECKeyPair,
    myCredential: Uint8Array,
    otherMembers: KeyPackage[],
  ): Promise<SerializedUpdate> {
    const { treekem, updatePath } = await TreeKEM.createGroup(
      myKeyPair,
      myCredential,
      otherMembers,
    );

    this.trees.set(groupId, treekem);
    const epoch = 1;
    this.epochs.set(groupId, epoch);

    // Derive group key from tree root
    const groupSecret = await treekem.deriveGroupSecret();
    await this.cipher.deriveGroupKey(groupId, epoch, groupSecret);

    return {
      updatePath: await serializeUpdatePath(updatePath),
      treeData: await serializeTree(treekem.getTree()),
      epoch,
    };
  }

  /**
   * Join an existing group using the current tree state.
   * The joiner reconstructs the tree from the serialized state
   * and awaits a tree update from an existing member.
   */
  async joinGroup(
    groupId: GroupId,
    treeDataJson: string,
    myLeafIndex: LeafIndex,
    myKeyPair: ECKeyPair,
  ): Promise<void> {
    const tree = await deserializeTree(treeDataJson);

    // Insert our full key pair at our leaf position
    const nodeIndex = myLeafIndex * 2;
    const leafNode = tree.nodes[nodeIndex];
    if (leafNode && leafNode.type === 'leaf') {
      leafNode.keyPair = myKeyPair;
    }

    const treekem = new TreeKEM(tree, myLeafIndex);
    this.trees.set(groupId, treekem);
    // Epoch will be set when we receive the next treeUpdate
  }

  /**
   * Process an incoming tree update from another member.
   */
  async processUpdate(
    groupId: GroupId,
    serializedUpdatePath: string,
    newEpoch: number,
  ): Promise<void> {
    const treekem = this.trees.get(groupId);
    if (!treekem) {
      throw new Error(`No tree state for group ${groupId}`);
    }

    const updatePath = await deserializeUpdatePath(serializedUpdatePath);
    await treekem.processUpdatePath(updatePath);

    this.epochs.set(groupId, newEpoch);

    // Derive the new group key
    const groupSecret = await treekem.deriveGroupSecret();
    await this.cipher.deriveGroupKey(groupId, newEpoch, groupSecret);
  }

  /**
   * Get the current epoch for a group.
   */
  getEpoch(groupId: GroupId): number {
    return this.epochs.get(groupId) ?? 0;
  }

  /**
   * Trigger a key update (PCS healing or routine rotation).
   */
  async update(groupId: GroupId): Promise<SerializedUpdate> {
    const treekem = this.trees.get(groupId);
    if (!treekem) {
      throw new Error(`No tree state for group ${groupId}`);
    }

    const updatePath = await treekem.update();
    const currentEpoch = this.epochs.get(groupId) ?? 0;
    const newEpoch = currentEpoch + 1;
    this.epochs.set(groupId, newEpoch);

    const groupSecret = await treekem.deriveGroupSecret();
    await this.cipher.deriveGroupKey(groupId, newEpoch, groupSecret);

    return {
      updatePath: await serializeUpdatePath(updatePath),
      treeData: await serializeTree(treekem.getTree()),
      epoch: newEpoch,
    };
  }

  /**
   * Handle member addition — extends tree, performs update.
   */
  async addMember(
    groupId: GroupId,
    newMemberKeyPackage: KeyPackage,
  ): Promise<SerializedUpdate & { newLeafIndex: LeafIndex }> {
    const treekem = this.trees.get(groupId);
    if (!treekem) {
      throw new Error(`No tree state for group ${groupId}`);
    }

    const { updatePath, newLeafIndex } =
      await treekem.addMember(newMemberKeyPackage);
    const currentEpoch = this.epochs.get(groupId) ?? 0;
    const newEpoch = currentEpoch + 1;
    this.epochs.set(groupId, newEpoch);

    const groupSecret = await treekem.deriveGroupSecret();
    await this.cipher.deriveGroupKey(groupId, newEpoch, groupSecret);

    return {
      updatePath: await serializeUpdatePath(updatePath),
      treeData: await serializeTree(treekem.getTree()),
      epoch: newEpoch,
      newLeafIndex,
    };
  }

  /**
   * Handle member removal — blanks leaf, performs update.
   */
  async removeMember(
    groupId: GroupId,
    leafIndex: LeafIndex,
  ): Promise<SerializedUpdate> {
    const treekem = this.trees.get(groupId);
    if (!treekem) {
      throw new Error(`No tree state for group ${groupId}`);
    }

    treekem.removeMember(leafIndex);
    const updatePath = await treekem.update();
    const currentEpoch = this.epochs.get(groupId) ?? 0;
    const newEpoch = currentEpoch + 1;
    this.epochs.set(groupId, newEpoch);

    const groupSecret = await treekem.deriveGroupSecret();
    await this.cipher.deriveGroupKey(groupId, newEpoch, groupSecret);

    return {
      updatePath: await serializeUpdatePath(updatePath),
      treeData: await serializeTree(treekem.getTree()),
      epoch: newEpoch,
    };
  }

  /**
   * Check if a group has an initialized tree.
   */
  hasTree(groupId: GroupId): boolean {
    return this.trees.has(groupId);
  }

  /**
   * Get the tree for a group (for inspection/debugging).
   */
  getTree(groupId: GroupId): RatchetTree | undefined {
    return this.trees.get(groupId)?.getTree();
  }
}
