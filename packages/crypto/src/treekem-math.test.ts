import { describe, expect, it } from 'vitest';
import {
  copath,
  directPath,
  isLeaf,
  leafToNode,
  left,
  level,
  nodeToLeaf,
  parent,
  right,
  root,
  sibling,
  treeSize,
} from './treekem-math';

describe('treekem-math', () => {
  describe('leafToNode / nodeToLeaf', () => {
    it('converts leaf indices to node indices', () => {
      expect(leafToNode(0)).toBe(0);
      expect(leafToNode(1)).toBe(2);
      expect(leafToNode(2)).toBe(4);
      expect(leafToNode(3)).toBe(6);
    });

    it('converts node indices back to leaf indices', () => {
      expect(nodeToLeaf(0)).toBe(0);
      expect(nodeToLeaf(2)).toBe(1);
      expect(nodeToLeaf(4)).toBe(2);
      expect(nodeToLeaf(6)).toBe(3);
    });

    it('roundtrips correctly', () => {
      for (let i = 0; i < 16; i++) {
        expect(nodeToLeaf(leafToNode(i))).toBe(i);
      }
    });
  });

  describe('isLeaf', () => {
    it('returns true for even indices', () => {
      expect(isLeaf(0)).toBe(true);
      expect(isLeaf(2)).toBe(true);
      expect(isLeaf(4)).toBe(true);
    });

    it('returns false for odd indices', () => {
      expect(isLeaf(1)).toBe(false);
      expect(isLeaf(3)).toBe(false);
      expect(isLeaf(5)).toBe(false);
    });
  });

  describe('treeSize', () => {
    it('computes total node count', () => {
      expect(treeSize(0)).toBe(0);
      expect(treeSize(1)).toBe(1);
      expect(treeSize(2)).toBe(3);
      expect(treeSize(3)).toBe(5);
      expect(treeSize(4)).toBe(7);
      expect(treeSize(5)).toBe(9);
      expect(treeSize(8)).toBe(15);
    });
  });

  describe('level', () => {
    it('returns 0 for leaf nodes', () => {
      expect(level(0)).toBe(0);
      expect(level(2)).toBe(0);
      expect(level(4)).toBe(0);
      expect(level(6)).toBe(0);
    });

    it('returns correct level for internal nodes', () => {
      // Node 1: binary 01 -> 1 trailing 1-bit
      expect(level(1)).toBe(1);
      // Node 3: binary 011 -> 2 trailing 1-bits
      expect(level(3)).toBe(2);
      // Node 5: binary 101 -> 1 trailing 1-bit
      expect(level(5)).toBe(1);
      // Node 7: binary 0111 -> 3 trailing 1-bits
      expect(level(7)).toBe(3);
    });
  });

  describe('root', () => {
    it('returns root node for various tree sizes', () => {
      expect(root(1)).toBe(0);
      expect(root(2)).toBe(1);
      expect(root(3)).toBe(3);
      expect(root(4)).toBe(3);
      expect(root(5)).toBe(7);
      expect(root(8)).toBe(7);
    });
  });

  describe('left / right', () => {
    it('returns children for a 4-leaf tree', () => {
      // Tree with 4 leaves (nodes 0-6):
      //        3
      //       / \
      //      1   5
      //     / \ / \
      //    0  2 4  6
      expect(left(1)).toBe(0);
      expect(right(1, 4)).toBe(2);
      expect(left(5)).toBe(4);
      expect(right(5, 4)).toBe(6);
      expect(left(3)).toBe(1);
      expect(right(3, 4)).toBe(5);
    });

    it('throws for leaf nodes', () => {
      expect(() => left(0)).toThrow();
      expect(() => right(0, 4)).toThrow();
    });
  });

  describe('parent', () => {
    it('returns parent for a 4-leaf tree', () => {
      expect(parent(0, 4)).toBe(1);
      expect(parent(2, 4)).toBe(1);
      expect(parent(4, 4)).toBe(5);
      expect(parent(6, 4)).toBe(5);
      expect(parent(1, 4)).toBe(3);
      expect(parent(5, 4)).toBe(3);
    });

    it('throws for root node', () => {
      expect(() => parent(3, 4)).toThrow();
      expect(() => parent(1, 2)).toThrow();
    });

    it('handles 3-leaf unbalanced tree', () => {
      // Tree with 3 leaves (nodes 0-4):
      //        3
      //       / \
      //      1   4
      //     / \
      //    0   2
      expect(parent(0, 3)).toBe(1);
      expect(parent(2, 3)).toBe(1);
      expect(parent(4, 3)).toBe(3);
      expect(parent(1, 3)).toBe(3);
    });
  });

  describe('sibling', () => {
    it('returns sibling for a 4-leaf tree', () => {
      expect(sibling(0, 4)).toBe(2);
      expect(sibling(2, 4)).toBe(0);
      expect(sibling(4, 4)).toBe(6);
      expect(sibling(6, 4)).toBe(4);
      expect(sibling(1, 4)).toBe(5);
      expect(sibling(5, 4)).toBe(1);
    });
  });

  describe('directPath', () => {
    it('returns path from leaf to root for a 4-leaf tree', () => {
      // Leaf 0 (node 0): parent is 1, then root 3
      expect(directPath(0, 4)).toEqual([1, 3]);
      // Leaf 1 (node 2): parent is 1, then root 3
      expect(directPath(2, 4)).toEqual([1, 3]);
      // Leaf 2 (node 4): parent is 5, then root 3
      expect(directPath(4, 4)).toEqual([5, 3]);
      // Leaf 3 (node 6): parent is 5, then root 3
      expect(directPath(6, 4)).toEqual([5, 3]);
    });

    it('returns empty for root', () => {
      expect(directPath(3, 4)).toEqual([]);
    });

    it('returns path for 2-leaf tree', () => {
      // Root is 1
      expect(directPath(0, 2)).toEqual([1]);
      expect(directPath(2, 2)).toEqual([1]);
    });

    it('handles 3-leaf unbalanced tree', () => {
      // Leaf 0 (node 0): parent 1, then root 3
      expect(directPath(0, 3)).toEqual([1, 3]);
      // Leaf 2 (node 4): parent 3 (since node 5 is out of bounds, parent is 3)
      expect(directPath(4, 3)).toEqual([3]);
    });
  });

  describe('copath', () => {
    it('returns copath for a 4-leaf tree', () => {
      // Leaf 0: direct path is [1, 3]. Siblings: sibling(0)=2, sibling(1)=5
      expect(copath(0, 4)).toEqual([2, 5]);
      // Leaf 1 (node 2): direct path is [1, 3]. Siblings: sibling(2)=0, sibling(1)=5
      expect(copath(2, 4)).toEqual([0, 5]);
      // Leaf 2 (node 4): direct path is [5, 3]. Siblings: sibling(4)=6, sibling(5)=1
      expect(copath(4, 4)).toEqual([6, 1]);
    });

    it('returns empty for root', () => {
      expect(copath(3, 4)).toEqual([]);
    });

    it('copath length matches direct path length', () => {
      for (const numLeaves of [2, 3, 4, 5, 8]) {
        for (let leaf = 0; leaf < numLeaves; leaf++) {
          const node = leaf * 2;
          expect(copath(node, numLeaves).length).toBe(
            directPath(node, numLeaves).length,
          );
        }
      }
    });
  });
});
