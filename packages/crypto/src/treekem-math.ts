import type { LeafIndex, NodeIndex } from './treekem-types';

/** Convert a leaf index to its node index in the flat array. */
export function leafToNode(leaf: LeafIndex): NodeIndex {
  return 2 * leaf;
}

/** Convert an even node index back to its leaf index. */
export function nodeToLeaf(node: NodeIndex): LeafIndex {
  return node >> 1;
}

/** Check if a node index refers to a leaf (even index). */
export function isLeaf(node: NodeIndex): boolean {
  return (node & 1) === 0;
}

/** Total number of nodes in a tree with the given number of leaves. */
export function treeSize(numLeaves: number): number {
  if (numLeaves === 0) return 0;
  return 2 * numLeaves - 1;
}

/**
 * Level of a node in the tree (0 for leaves).
 * The level is the number of trailing 1-bits when the index is viewed
 * as (index >> 1) in the odd-indexed scheme. For the standard MLS
 * left-balanced tree, level = number of times (node+1) can be divided by 2,
 * minus 1 when node is even (leaf).
 */
export function level(node: NodeIndex): number {
  if ((node & 1) === 0) return 0;
  let k = 0;
  let n = node;
  while ((n & 1) === 1) {
    n >>= 1;
    k++;
  }
  return k;
}

/** Root node index for a tree with the given number of leaves. */
export function root(numLeaves: number): NodeIndex {
  if (numLeaves === 0) return 0;
  const size = treeSize(numLeaves);
  // Root is at (1 << log2(size)) - 1 for power-of-2 sizes.
  // For general sizes, root is the highest-level node within bounds.
  return (1 << Math.floor(Math.log2(size))) - 1;
}

/** Left child of an internal node. */
export function left(node: NodeIndex): NodeIndex {
  const k = level(node);
  if (k === 0) throw new Error('Leaf node has no children');
  return node ^ (1 << (k - 1));
}

/** Right child of an internal node, clamped for unbalanced trees. */
export function right(node: NodeIndex, numLeaves: number): NodeIndex {
  const k = level(node);
  if (k === 0) throw new Error('Leaf node has no children');
  const size = treeSize(numLeaves);
  let r = node ^ (3 << (k - 1));
  // Clamp: walk down left until within bounds
  while (r >= size) {
    r = left(r);
  }
  return r;
}

/**
 * One step toward the parent in a complete binary tree (ignoring bounds).
 * Uses the MLS RFC 9420 formula.
 */
function parentStep(node: NodeIndex): NodeIndex {
  const k = level(node);
  const b = (node >> (k + 1)) & 1;
  return (node | (1 << k)) ^ (b << (k + 1));
}

/** Parent of a node, handling unbalanced trees by stepping up until in bounds. */
export function parent(node: NodeIndex, numLeaves: number): NodeIndex {
  const rootNode = root(numLeaves);
  if (node === rootNode) throw new Error('Root node has no parent');

  const size = treeSize(numLeaves);
  let p = parentStep(node);
  while (p >= size) {
    p = parentStep(p);
  }
  return p;
}

/** Sibling of a node (the other child of this node's parent). */
export function sibling(node: NodeIndex, numLeaves: number): NodeIndex {
  const p = parent(node, numLeaves);
  const l = left(p);
  const r = right(p, numLeaves);
  return node === l ? r : l;
}

/**
 * Direct path from a node to the root (inclusive of the node, exclusive of root).
 * Returns node indices in bottom-up order.
 */
export function directPath(
  node: NodeIndex,
  numLeaves: number,
): NodeIndex[] {
  const rootNode = root(numLeaves);
  if (node === rootNode) return [];

  const path: NodeIndex[] = [];
  let current = node;
  while (current !== rootNode) {
    current = parent(current, numLeaves);
    if (current !== rootNode) {
      path.push(current);
    }
  }
  // Include root
  path.push(rootNode);
  return path;
}

/**
 * Copath: for each node on the direct path, return its sibling.
 * The copath determines who receives encrypted path secrets.
 */
export function copath(
  node: NodeIndex,
  numLeaves: number,
): NodeIndex[] {
  const rootNode = root(numLeaves);
  if (node === rootNode) return [];

  const cp: NodeIndex[] = [];
  let current = node;
  while (current !== rootNode) {
    cp.push(sibling(current, numLeaves));
    current = parent(current, numLeaves);
  }
  return cp;
}
