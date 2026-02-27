import { describe, expect, it } from 'vitest';
import type { Proposal } from './mls-proposals';
import {
  advanceTranscriptHash,
  computeTreeHash,
  initialTranscriptHash,
} from './mls-transcript';

describe('MLS Transcript Hashing', () => {
  describe('initialTranscriptHash', () => {
    it('returns SHA-256 of empty string', () => {
      const hash = initialTranscriptHash();
      expect(hash).toBe(
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      );
      expect(hash).toHaveLength(64); // 32 bytes hex-encoded
    });
  });

  describe('advanceTranscriptHash', () => {
    it('produces a deterministic hash for the same inputs', async () => {
      const prevHash = initialTranscriptHash();
      const content = { proposals: [] as Proposal[], committer: 0 };

      const hash1 = await advanceTranscriptHash(prevHash, content);
      const hash2 = await advanceTranscriptHash(prevHash, content);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it('produces different hashes for different proposals', async () => {
      const prevHash = initialTranscriptHash();

      const hash1 = await advanceTranscriptHash(prevHash, {
        proposals: [{ type: 'update' }],
        committer: 0,
      });
      const hash2 = await advanceTranscriptHash(prevHash, {
        proposals: [{ type: 'remove', removedLeafIndex: 1 }],
        committer: 0,
      });

      expect(hash1).not.toBe(hash2);
    });

    it('produces different hashes for different committers', async () => {
      const prevHash = initialTranscriptHash();
      const proposals: Proposal[] = [{ type: 'update' }];

      const hash1 = await advanceTranscriptHash(prevHash, {
        proposals,
        committer: 0,
      });
      const hash2 = await advanceTranscriptHash(prevHash, {
        proposals,
        committer: 1,
      });

      expect(hash1).not.toBe(hash2);
    });

    it('chains correctly — hash of hash produces a new distinct value', async () => {
      const h0 = initialTranscriptHash();
      const content = { proposals: [] as Proposal[], committer: 0 };

      const h1 = await advanceTranscriptHash(h0, content);
      const h2 = await advanceTranscriptHash(h1, content);

      expect(h1).not.toBe(h0);
      expect(h2).not.toBe(h1);
      expect(h2).not.toBe(h0);
    });
  });

  describe('computeTreeHash', () => {
    it('produces a deterministic hash for the same tree data', async () => {
      const treeData = '{"nodes":[],"numLeaves":1}';

      const hash1 = await computeTreeHash(treeData);
      const hash2 = await computeTreeHash(treeData);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it('produces different hashes for different tree data', async () => {
      const hash1 = await computeTreeHash('{"nodes":[],"numLeaves":1}');
      const hash2 = await computeTreeHash('{"nodes":[],"numLeaves":2}');

      expect(hash1).not.toBe(hash2);
    });
  });
});
