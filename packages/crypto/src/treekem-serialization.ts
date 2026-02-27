import type {
  EncryptedPathSecret,
  LeafNode,
  ParentNode,
  RatchetTree,
  TreeNode,
  UpdatePath,
} from './treekem-types';

const ECDH_IMPORT_PARAMS: EcKeyImportParams = {
  name: 'ECDH',
  namedCurve: 'P-256',
};

// --- Base64 helpers ---

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// --- Serialized types (JSON-safe) ---

interface SerializedLeafNode {
  type: 'leaf';
  index: number;
  publicKey: string | null; // base64 raw ECDH public key
  credential: string | null; // base64
}

interface SerializedParentNode {
  type: 'parent';
  index: number;
  publicKey: string | null; // base64 raw ECDH public key
  unmergedLeaves: number[];
}

type SerializedTreeNode = SerializedLeafNode | SerializedParentNode;

interface SerializedTree {
  nodes: (SerializedTreeNode | null)[];
  numLeaves: number;
}

interface SerializedEncryptedPathSecret {
  targetNode: number;
  ciphertext: string; // base64
  ephemeralPublicKey: string; // base64 raw
  nonce: string; // base64
}

interface SerializedUpdatePath {
  sender: number;
  pathPublicKeys: string[]; // base64 raw keys
  encryptedPathSecrets: SerializedEncryptedPathSecret[][];
}

// --- Tree serialization (public keys only, no secrets) ---

async function serializeNode(
  node: TreeNode | null,
): Promise<SerializedTreeNode | null> {
  if (!node) return null;

  if (node.type === 'leaf') {
    const leaf = node as LeafNode;
    let publicKey: string | null = null;
    if (leaf.keyPair?.publicKey) {
      const raw = await crypto.subtle.exportKey('raw', leaf.keyPair.publicKey);
      publicKey = uint8ToBase64(new Uint8Array(raw));
    }
    return {
      type: 'leaf',
      index: leaf.index,
      publicKey,
      credential: leaf.credential ? uint8ToBase64(leaf.credential) : null,
    };
  }

  // Parent node — strip pathSecret (private)
  const parent = node as ParentNode;
  let publicKey: string | null = null;
  if (parent.keyPair?.publicKey) {
    const raw = await crypto.subtle.exportKey('raw', parent.keyPair.publicKey);
    publicKey = uint8ToBase64(new Uint8Array(raw));
  }
  return {
    type: 'parent',
    index: parent.index,
    publicKey,
    unmergedLeaves: parent.unmergedLeaves,
  };
}

/**
 * Serialize a RatchetTree to a JSON string.
 * Exports only public keys and structure — no private keys or path secrets.
 */
export async function serializeTree(tree: RatchetTree): Promise<string> {
  const serializedNodes = await Promise.all(tree.nodes.map(serializeNode));
  const serialized: SerializedTree = {
    nodes: serializedNodes,
    numLeaves: tree.numLeaves,
  };
  return JSON.stringify(serialized);
}

/**
 * Deserialize a JSON string back into a RatchetTree.
 * Re-imports public keys via crypto.subtle.importKey.
 * Private keys and path secrets will be null (must be populated locally).
 */
export async function deserializeTree(json: string): Promise<RatchetTree> {
  const serialized: SerializedTree = JSON.parse(json);
  const nodes: (TreeNode | null)[] = [];

  for (const sNode of serialized.nodes) {
    if (!sNode) {
      nodes.push(null);
      continue;
    }

    if (sNode.type === 'leaf') {
      let publicKey: CryptoKey | null = null;
      if (sNode.publicKey) {
        publicKey = await crypto.subtle.importKey(
          'raw',
          base64ToUint8(sNode.publicKey).buffer as ArrayBuffer,
          ECDH_IMPORT_PARAMS,
          true,
          [],
        );
      }
      nodes.push({
        type: 'leaf',
        index: sNode.index,
        keyPair: publicKey
          ? { publicKey, privateKey: null as unknown as CryptoKey }
          : null,
        credential: sNode.credential ? base64ToUint8(sNode.credential) : null,
      } satisfies LeafNode);
    } else {
      let publicKey: CryptoKey | null = null;
      if (sNode.publicKey) {
        publicKey = await crypto.subtle.importKey(
          'raw',
          base64ToUint8(sNode.publicKey).buffer as ArrayBuffer,
          ECDH_IMPORT_PARAMS,
          true,
          [],
        );
      }
      nodes.push({
        type: 'parent',
        index: sNode.index,
        keyPair: publicKey
          ? { publicKey, privateKey: null as unknown as CryptoKey }
          : null,
        pathSecret: null,
        unmergedLeaves: sNode.unmergedLeaves,
      } satisfies ParentNode);
    }
  }

  return { nodes, numLeaves: serialized.numLeaves };
}

// --- UpdatePath serialization ---

/**
 * Serialize an UpdatePath to a JSON string.
 * Exports public keys and encrypted path secrets as base64.
 */
export async function serializeUpdatePath(
  updatePath: UpdatePath,
): Promise<string> {
  const pathPublicKeys: string[] = [];
  for (const key of updatePath.pathPublicKeys) {
    const raw = await crypto.subtle.exportKey('raw', key);
    pathPublicKeys.push(uint8ToBase64(new Uint8Array(raw)));
  }

  const encryptedPathSecrets: SerializedEncryptedPathSecret[][] = [];
  for (const level of updatePath.encryptedPathSecrets) {
    const serializedLevel: SerializedEncryptedPathSecret[] = [];
    for (const eps of level) {
      const ephRaw = await crypto.subtle.exportKey(
        'raw',
        eps.ephemeralPublicKey,
      );
      serializedLevel.push({
        targetNode: eps.targetNode,
        ciphertext: uint8ToBase64(eps.ciphertext),
        ephemeralPublicKey: uint8ToBase64(new Uint8Array(ephRaw)),
        nonce: uint8ToBase64(eps.nonce),
      });
    }
    encryptedPathSecrets.push(serializedLevel);
  }

  const serialized: SerializedUpdatePath = {
    sender: updatePath.sender,
    pathPublicKeys,
    encryptedPathSecrets,
  };
  return JSON.stringify(serialized);
}

/**
 * Deserialize a JSON string back into an UpdatePath.
 * Re-imports public keys via crypto.subtle.importKey.
 */
export async function deserializeUpdatePath(json: string): Promise<UpdatePath> {
  const serialized: SerializedUpdatePath = JSON.parse(json);

  const pathPublicKeys: CryptoKey[] = [];
  for (const b64 of serialized.pathPublicKeys) {
    const key = await crypto.subtle.importKey(
      'raw',
      base64ToUint8(b64).buffer as ArrayBuffer,
      ECDH_IMPORT_PARAMS,
      true,
      [],
    );
    pathPublicKeys.push(key);
  }

  const encryptedPathSecrets: EncryptedPathSecret[][] = [];
  for (const level of serialized.encryptedPathSecrets) {
    const desLevel: EncryptedPathSecret[] = [];
    for (const sEps of level) {
      const ephKey = await crypto.subtle.importKey(
        'raw',
        base64ToUint8(sEps.ephemeralPublicKey).buffer as ArrayBuffer,
        ECDH_IMPORT_PARAMS,
        true,
        [],
      );
      desLevel.push({
        targetNode: sEps.targetNode,
        ciphertext: base64ToUint8(sEps.ciphertext),
        ephemeralPublicKey: ephKey,
        nonce: base64ToUint8(sEps.nonce),
      });
    }
    encryptedPathSecrets.push(desLevel);
  }

  return {
    sender: serialized.sender,
    pathPublicKeys,
    encryptedPathSecrets,
  };
}
