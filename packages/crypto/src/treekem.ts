import {
  decryptPathSecret,
  derivePathSecret,
  deriveRootSecret,
  encryptPathSecret,
  generateECDHKeyPair,
} from './treekem-crypto';
import { TreeKEMError, TreeKEMInvalidStateError } from './treekem-errors';
import {
  copath,
  directPath,
  leafToNode,
  left,
  parent as parentOf,
  right,
  root,
  treeSize,
} from './treekem-math';
import type {
  ECKeyPair,
  EncryptedPathSecret,
  KeyPackage,
  LeafIndex,
  LeafNode,
  NodeIndex,
  ParentNode,
  RatchetTree,
  TreeNode,
  UpdatePath,
} from './treekem-types';

export class TreeKEM {
  private tree: RatchetTree;
  private myLeafIndex: LeafIndex;

  constructor(tree: RatchetTree, myLeafIndex: LeafIndex) {
    this.tree = tree;
    this.myLeafIndex = myLeafIndex;
  }

  /**
   * Create a new group. The creator is leaf 0.
   * After creation, the creator performs an initial update to establish path secrets.
   */
  static async createGroup(
    creatorKeyPair: ECKeyPair,
    creatorCredential: Uint8Array,
    otherMembers: KeyPackage[],
  ): Promise<{ treekem: TreeKEM; updatePath: UpdatePath }> {
    const numLeaves = 1 + otherMembers.length;
    const size = treeSize(numLeaves);
    const nodes: (TreeNode | null)[] = new Array(size).fill(null);

    // Leaf 0: creator
    nodes[0] = {
      type: 'leaf',
      index: 0,
      keyPair: creatorKeyPair,
      credential: creatorCredential,
    } satisfies LeafNode;

    // Other members at leaf indices 1, 2, ...
    for (let i = 0; i < otherMembers.length; i++) {
      const leafIndex = i + 1;
      const nodeIndex = leafToNode(leafIndex);
      nodes[nodeIndex] = {
        type: 'leaf',
        index: leafIndex,
        keyPair: {
          publicKey: otherMembers[i].publicKey,
          // We don't have their private key
          privateKey: null as unknown as CryptoKey,
        },
        credential: otherMembers[i].credential,
      } satisfies LeafNode;
    }

    // Initialize blank parent nodes
    for (let i = 0; i < size; i++) {
      if (i % 2 === 1 && nodes[i] === null) {
        nodes[i] = {
          type: 'parent',
          index: i,
          keyPair: null,
          pathSecret: null,
          unmergedLeaves: [],
        } satisfies ParentNode;
      }
    }

    const tree: RatchetTree = { nodes, numLeaves };
    const treekem = new TreeKEM(tree, 0);

    // Creator performs initial update to establish all path secrets
    const updatePath = await treekem.update();

    return { treekem, updatePath };
  }

  /**
   * Perform a key update (self-update for Post-Compromise Security).
   *
   * 1. Generate fresh leaf key pair + leaf secret
   * 2. Derive path secrets up to root via HKDF
   * 3. Generate fresh key pair for each internal node on the direct path
   * 4. Encrypt each path secret to the resolution of the copath node
   * 5. Return the UpdatePath to broadcast
   */
  async update(): Promise<UpdatePath> {
    const myNode = leafToNode(this.myLeafIndex);
    const numLeaves = this.tree.numLeaves;
    const _rootNode = root(numLeaves);

    // Fresh leaf key pair
    const newLeafKeyPair = await generateECDHKeyPair();
    const leafNode = this.tree.nodes[myNode] as LeafNode;
    leafNode.keyPair = newLeafKeyPair;

    // Special case: single member (tree is just one leaf = root)
    if (numLeaves === 1) {
      const _leafSecret = crypto.getRandomValues(new Uint8Array(32));
      return {
        sender: this.myLeafIndex,
        pathPublicKeys: [newLeafKeyPair.publicKey],
        encryptedPathSecrets: [[]],
      };
    }

    // Generate leaf secret (fresh entropy)
    const leafSecret = crypto.getRandomValues(new Uint8Array(32));

    // Get the direct path (parent nodes from leaf toward root, inclusive of root)
    const dp = directPath(myNode, numLeaves);
    // Copath: sibling of each step
    const cp = copath(myNode, numLeaves);

    const pathPublicKeys: CryptoKey[] = [newLeafKeyPair.publicKey];
    const encryptedPathSecrets: EncryptedPathSecret[][] = [[]]; // no encryptions at leaf level

    // Derive path secrets bottom-up
    let currentSecret: Uint8Array = leafSecret as any;
    for (let i = 0; i < dp.length; i++) {
      const pathNode = dp[i];
      const copathNode = cp[i];

      // Derive path secret for this node
      const nodeSecret = await derivePathSecret(
        currentSecret,
        `treekem-node-${pathNode}`,
      );

      // Fresh key pair for this internal node
      const nodeKeyPair = await generateECDHKeyPair();

      // Update the tree node
      const pNode = this.ensureParentNode(pathNode);
      pNode.keyPair = nodeKeyPair;
      pNode.pathSecret = nodeSecret;
      pNode.unmergedLeaves = [];

      // Encrypt this node's path secret to each node in the resolution of the copath node
      const targets = this.resolution(copathNode);
      const encrypted: EncryptedPathSecret[] = [];
      for (const targetNodeIndex of targets) {
        const targetNode = this.tree.nodes[targetNodeIndex];
        if (!targetNode) continue;

        const targetPubKey = this.getPublicKey(targetNode);
        if (!targetPubKey) continue;

        encrypted.push(
          await encryptPathSecret(nodeSecret, targetPubKey, targetNodeIndex),
        );
      }

      pathPublicKeys.push(nodeKeyPair.publicKey);
      encryptedPathSecrets.push(encrypted);
      currentSecret = nodeSecret;
    }

    return {
      sender: this.myLeafIndex,
      pathPublicKeys,
      encryptedPathSecrets,
    };
  }

  /**
   * Process an incoming UpdatePath from another member.
   *
   * Finds the encrypted path secret we can decrypt (based on our position
   * relative to the sender), decrypts it, derives remaining path secrets
   * upward, and updates the tree.
   */
  async processUpdatePath(updatePath: UpdatePath): Promise<void> {
    const senderNode = leafToNode(updatePath.sender);
    const myNode = leafToNode(this.myLeafIndex);
    const numLeaves = this.tree.numLeaves;

    // Update sender's leaf public key
    const senderLeaf = this.tree.nodes[senderNode] as LeafNode;
    if (senderLeaf) {
      senderLeaf.keyPair = {
        publicKey: updatePath.pathPublicKeys[0],
        privateKey: null as unknown as CryptoKey,
      };
    }

    // Get sender's direct path and copath
    const senderDP = directPath(senderNode, numLeaves);
    const senderCP = copath(senderNode, numLeaves);

    // Update public keys for all nodes on the sender's direct path
    for (let i = 0; i < senderDP.length; i++) {
      const pathNode = senderDP[i];
      const pNode = this.ensureParentNode(pathNode);
      pNode.keyPair = {
        publicKey: updatePath.pathPublicKeys[i + 1],
        privateKey: null as unknown as CryptoKey,
      };
      pNode.unmergedLeaves = [];
    }

    // Find which copath node's subtree contains us
    // That determines which encrypted path secret we can decrypt
    let decryptionLevel = -1;
    for (let i = 0; i < senderCP.length; i++) {
      const copathNode = senderCP[i];
      if (this.isInSubtree(myNode, copathNode)) {
        decryptionLevel = i;
        break;
      }
    }

    if (decryptionLevel === -1) {
      throw new TreeKEMError('Cannot find decryption point in UpdatePath');
    }

    // Find the encrypted secret targeted at a node where we have a private key
    const encryptedSecrets =
      updatePath.encryptedPathSecrets[decryptionLevel + 1];
    const myPrivateKey = this.findMyPrivateKey(senderCP[decryptionLevel]);

    if (!myPrivateKey) {
      throw new TreeKEMError('No private key available to decrypt path secret');
    }

    // Find which encrypted secret targets a node we can decrypt
    const myResolution = this.findMyTargetNode(
      senderCP[decryptionLevel],
      encryptedSecrets,
    );

    if (!myResolution) {
      throw new TreeKEMError('No encrypted path secret found for our node');
    }

    // Decrypt the path secret
    let currentSecret = await decryptPathSecret(myResolution, myPrivateKey);

    // Store the decrypted path secret at this level
    const pathNodeAtLevel = senderDP[decryptionLevel];
    const pNode = this.ensureParentNode(pathNodeAtLevel);
    pNode.pathSecret = currentSecret;

    // Derive remaining path secrets upward
    for (let i = decryptionLevel + 1; i < senderDP.length; i++) {
      const pathNode = senderDP[i];
      currentSecret = await derivePathSecret(
        currentSecret,
        `treekem-node-${pathNode}`,
      );
      const node = this.ensureParentNode(pathNode);
      node.pathSecret = currentSecret;
    }
  }

  /**
   * Add a new member to the group.
   * Places the new member at the first blank leaf or extends the tree.
   * The adder then performs an update.
   */
  async addMember(
    newMember: KeyPackage,
  ): Promise<{ updatePath: UpdatePath; newLeafIndex: LeafIndex }> {
    // Find first blank leaf, or extend
    let newLeafIndex: LeafIndex | null = null;

    for (let i = 0; i < this.tree.numLeaves; i++) {
      const nodeIndex = leafToNode(i);
      const node = this.tree.nodes[nodeIndex] as LeafNode | null;
      if (!node || (node.keyPair === null && node.credential === null)) {
        newLeafIndex = i;
        break;
      }
    }

    if (newLeafIndex === null) {
      // Extend the tree
      newLeafIndex = this.tree.numLeaves;
      this.tree.numLeaves++;
      const newSize = treeSize(this.tree.numLeaves);
      // Extend nodes array
      while (this.tree.nodes.length < newSize) {
        const idx = this.tree.nodes.length;
        if (idx % 2 === 1) {
          this.tree.nodes.push({
            type: 'parent',
            index: idx,
            keyPair: null,
            pathSecret: null,
            unmergedLeaves: [],
          } satisfies ParentNode);
        } else {
          this.tree.nodes.push(null);
        }
      }
    }

    // Place the new member
    const nodeIndex = leafToNode(newLeafIndex);
    this.tree.nodes[nodeIndex] = {
      type: 'leaf',
      index: newLeafIndex,
      keyPair: {
        publicKey: newMember.publicKey,
        privateKey: null as unknown as CryptoKey,
      },
      credential: newMember.credential,
    } satisfies LeafNode;

    // Adder performs an update to refresh path secrets
    const updatePath = await this.update();

    return { updatePath, newLeafIndex };
  }

  /**
   * Remove a member by blanking their leaf and all ancestor nodes.
   * Caller should follow up with update() to refresh their own path.
   */
  removeMember(targetLeaf: LeafIndex): void {
    const targetNode = leafToNode(targetLeaf);
    if (targetLeaf === this.myLeafIndex) {
      throw new TreeKEMInvalidStateError('Cannot remove self');
    }

    const node = this.tree.nodes[targetNode] as LeafNode | null;
    if (!node) {
      throw new TreeKEMInvalidStateError(`No member at leaf ${targetLeaf}`);
    }

    // Blank the leaf
    node.keyPair = null;
    node.credential = null;

    // Blank all ancestors
    const dp = directPath(targetNode, this.tree.numLeaves);
    for (const ancestor of dp) {
      const pNode = this.tree.nodes[ancestor] as ParentNode | null;
      if (pNode) {
        pNode.keyPair = null;
        pNode.pathSecret = null;
      }
    }
  }

  /**
   * Derive the group secret from the root node's path secret.
   * This secret can be fed into GroupCipher.deriveGroupKey().
   */
  async deriveGroupSecret(): Promise<Uint8Array> {
    const numLeaves = this.tree.numLeaves;
    const rootNode = root(numLeaves);

    // Single member: derive from leaf
    if (numLeaves === 1) {
      const leaf = this.tree.nodes[0] as LeafNode;
      if (!leaf?.keyPair) {
        throw new TreeKEMInvalidStateError('Root leaf has no key');
      }
      // Use the public key as input material
      const raw = await crypto.subtle.exportKey('raw', leaf.keyPair.publicKey);
      return deriveRootSecret(new Uint8Array(raw));
    }

    const rootTreeNode = this.tree.nodes[rootNode] as ParentNode | null;
    if (!rootTreeNode?.pathSecret) {
      throw new TreeKEMInvalidStateError(
        'Root node has no path secret; run update() first',
      );
    }

    return deriveRootSecret(rootTreeNode.pathSecret);
  }

  /** Get the current tree state. */
  getTree(): RatchetTree {
    return this.tree;
  }

  /** Get my leaf index in the tree. */
  getMyLeafIndex(): LeafIndex {
    return this.myLeafIndex;
  }

  /** Count non-blank members. */
  getMemberCount(): number {
    let count = 0;
    for (let i = 0; i < this.tree.numLeaves; i++) {
      const node = this.tree.nodes[leafToNode(i)] as LeafNode | null;
      if (node?.keyPair && node?.credential) {
        count++;
      }
    }
    return count;
  }

  /**
   * Resolution of a node: the set of non-blank leaf descendants
   * (or the node itself if it's non-blank).
   */
  private resolution(nodeIndex: NodeIndex): NodeIndex[] {
    const node = this.tree.nodes[nodeIndex];
    if (!node) return [];

    if (node.type === 'leaf') {
      return node.keyPair ? [nodeIndex] : [];
    }

    // Parent node
    if (node.keyPair) {
      return [nodeIndex];
    }

    // Blank parent: recurse into children
    const numLeaves = this.tree.numLeaves;
    const l = left(nodeIndex);
    const r = right(nodeIndex, numLeaves);
    return [...this.resolution(l), ...this.resolution(r)];
  }

  /** Check if a node is in the subtree rooted at ancestor. */
  private isInSubtree(node: NodeIndex, subtreeRoot: NodeIndex): boolean {
    if (node === subtreeRoot) return true;
    const numLeaves = this.tree.numLeaves;
    const rootNode = root(numLeaves);

    // Walk up from node toward root; if we hit subtreeRoot, it's an ancestor
    let current = node;
    while (current !== rootNode) {
      current = parentOf(current, numLeaves);
      if (current === subtreeRoot) return true;
    }
    return false;
  }

  /** Find our private key within a subtree (either our leaf or a node on our direct path). */
  private findMyPrivateKey(copathNode: NodeIndex): CryptoKey | null {
    const myNode = leafToNode(this.myLeafIndex);

    // Check if our leaf is directly in the resolution
    const leaf = this.tree.nodes[myNode] as LeafNode;
    if (leaf?.keyPair?.privateKey) {
      return leaf.keyPair.privateKey;
    }

    // Check nodes on our direct path that are in this subtree
    const dp = directPath(myNode, this.tree.numLeaves);
    for (const pathNode of dp) {
      if (this.isInSubtree(pathNode, copathNode)) {
        const node = this.tree.nodes[pathNode] as ParentNode | null;
        if (node?.keyPair?.privateKey) {
          return node.keyPair.privateKey;
        }
      }
    }

    return null;
  }

  /** Find the encrypted path secret targeting a node where we can decrypt. */
  private findMyTargetNode(
    _copathNode: NodeIndex,
    encryptedSecrets: EncryptedPathSecret[],
  ): EncryptedPathSecret | null {
    const myNode = leafToNode(this.myLeafIndex);

    // First check if any secret targets our leaf directly
    for (const es of encryptedSecrets) {
      if (es.targetNode === myNode) {
        return es;
      }
    }

    // Check nodes on our direct path
    const dp = directPath(myNode, this.tree.numLeaves);
    for (const pathNode of dp) {
      for (const es of encryptedSecrets) {
        if (es.targetNode === pathNode) {
          return es;
        }
      }
    }

    return null;
  }

  private getPublicKey(node: TreeNode): CryptoKey | null {
    if (!node) return null;
    return node.keyPair?.publicKey ?? null;
  }

  private ensureParentNode(nodeIndex: NodeIndex): ParentNode {
    let node = this.tree.nodes[nodeIndex];
    if (!node || node.type !== 'parent') {
      node = {
        type: 'parent',
        index: nodeIndex,
        keyPair: null,
        pathSecret: null,
        unmergedLeaves: [],
      } satisfies ParentNode;
      this.tree.nodes[nodeIndex] = node;
    }
    return node as ParentNode;
  }
}
