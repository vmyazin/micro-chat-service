import type { Proposal } from './mls-proposals';

/**
 * Advance the transcript hash by hashing the previous hash
 * concatenated with the serialized commit content.
 *
 * transcriptHash_n = SHA-256(transcriptHash_{n-1} || serialize(commitContent))
 */
export async function advanceTranscriptHash(
  prevHash: string,
  commitContent: { proposals: Proposal[]; committer: number },
): Promise<string> {
  const encoder = new TextEncoder();
  const payload = prevHash + JSON.stringify(commitContent);
  const data = encoder.encode(payload);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return hexEncode(new Uint8Array(hash));
}

/**
 * Compute a deterministic hash of the serialized tree data.
 * Used in GroupContext to bind the tree state to a specific epoch.
 */
export async function computeTreeHash(treeData: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(treeData);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return hexEncode(new Uint8Array(hash));
}

/**
 * Returns the initial transcript hash (epoch 0 — before any commits).
 * This is the SHA-256 of the empty string, hex-encoded.
 */
export function initialTranscriptHash(): string {
  // SHA-256('') = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
  return 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
}

function hexEncode(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}
