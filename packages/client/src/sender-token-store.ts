/**
 * Sender Token Store
 *
 * Manages a pool of anonymous sender tokens for Sealed Sender messaging.
 * Tokens are issued by the server but not linked to the user's identity,
 * allowing messages to be sent without the server knowing who sent them.
 */

import type { GroupCipher } from '@microchat/crypto';
import type {
  GroupId,
  SealedSenderPayload,
  SealedSenderToken,
  UserId,
} from '@microchat/shared';

const MIN_TOKEN_THRESHOLD = 3;
const DEFAULT_BATCH_SIZE = 10;
const TOKEN_EXPIRY_BUFFER = 5 * 60 * 1000; // 5 minutes before actual expiry

interface TokenPool {
  tokens: SealedSenderToken[];
  expiresAt: Date;
}

interface TokenResponse {
  tokens: SealedSenderToken[];
  expiresAt: string;
}

export interface SenderTokenStoreOptions {
  baseUrl: string;
  /** Minimum tokens before auto-refill (default: 3) */
  minThreshold?: number;
  /** Batch size when requesting tokens (default: 10) */
  batchSize?: number;
}

export class SenderTokenStore {
  private pools: Map<GroupId, TokenPool> = new Map();
  private pendingRefills: Map<GroupId, Promise<void>> = new Map();

  constructor(private options: SenderTokenStoreOptions) {}

  /**
   * Get a token for the specified group.
   * Auto-refills the pool if running low.
   */
  async getToken(groupId: GroupId): Promise<SealedSenderToken | null> {
    let pool = this.pools.get(groupId);

    // Check if pool exists and isn't expired
    if (
      pool &&
      new Date() < new Date(pool.expiresAt.getTime() - TOKEN_EXPIRY_BUFFER)
    ) {
      if (pool.tokens.length > 0) {
        const token = pool.tokens.pop()!;

        // Trigger async refill if running low
        if (
          pool.tokens.length <=
          (this.options.minThreshold ?? MIN_TOKEN_THRESHOLD)
        ) {
          this.maybeRefill(groupId);
        }

        return token;
      }
    }

    // No valid pool or empty - need to refill
    await this.refillTokens(groupId);
    pool = this.pools.get(groupId);

    if (pool && pool.tokens.length > 0) {
      return pool.tokens.pop()!;
    }

    return null;
  }

  /**
   * Check if tokens are available for a group
   */
  hasTokens(groupId: GroupId): boolean {
    const pool = this.pools.get(groupId);
    return (
      pool !== undefined &&
      pool.tokens.length > 0 &&
      new Date() < new Date(pool.expiresAt.getTime() - TOKEN_EXPIRY_BUFFER)
    );
  }

  /**
   * Pre-fetch tokens for a group (call when opening a chat)
   */
  async prefetchTokens(groupId: GroupId): Promise<void> {
    if (!this.hasTokens(groupId)) {
      await this.refillTokens(groupId);
    }
  }

  /**
   * Encrypt sender identity for inclusion in sealed sender messages.
   * This allows recipients to verify who sent the message while keeping
   * the sender's identity hidden from the server.
   */
  async encryptSenderIdentity(
    senderId: UserId,
    senderName: string,
    cipher: GroupCipher,
    groupId: GroupId,
    epoch: number,
  ): Promise<string> {
    const payload: SealedSenderPayload = {
      senderId,
      senderName,
      timestamp: new Date().toISOString(),
    };

    const encrypted = await cipher.encrypt(
      groupId,
      epoch,
      JSON.stringify(payload),
    );

    return JSON.stringify(encrypted);
  }

  /**
   * Decrypt sender identity from a sealed sender message.
   */
  async decryptSenderIdentity(
    sealedSender: string,
    cipher: GroupCipher,
    groupId: GroupId,
  ): Promise<SealedSenderPayload | null> {
    try {
      const encrypted = JSON.parse(sealedSender) as {
        ciphertext: string;
        nonce: string;
        epoch: number;
      };

      const decrypted = await cipher.decrypt(groupId, {
        ciphertext: encrypted.ciphertext,
        nonce: encrypted.nonce,
        epoch: encrypted.epoch,
      });

      return JSON.parse(decrypted) as SealedSenderPayload;
    } catch {
      return null;
    }
  }

  private async maybeRefill(groupId: GroupId): Promise<void> {
    if (this.pendingRefills.has(groupId)) {
      return; // Already refilling
    }

    const refillPromise = this.refillTokens(groupId).finally(() => {
      this.pendingRefills.delete(groupId);
    });

    this.pendingRefills.set(groupId, refillPromise);
  }

  private async refillTokens(groupId: GroupId): Promise<void> {
    const batchSize = this.options.batchSize ?? DEFAULT_BATCH_SIZE;

    try {
      const response = await fetch(
        `${this.options.baseUrl}/api/groups/${groupId}/sender-tokens`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ count: batchSize }),
          credentials: 'include',
        },
      );

      if (!response.ok) {
        console.error('Failed to fetch sender tokens:', await response.text());
        return;
      }

      const data = (await response.json()) as TokenResponse;

      this.pools.set(groupId, {
        tokens: data.tokens,
        expiresAt: new Date(data.expiresAt),
      });
    } catch (error) {
      console.error('Error fetching sender tokens:', error);
    }
  }
}
