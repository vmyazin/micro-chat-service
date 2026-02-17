import type { GroupId } from '@microchat/shared';
import type { KeyStore } from './key-store';

export interface ErasureAuditEntry {
  groupId: GroupId;
  timestamp: Date;
  keyCount: number;
}

export class CryptoErasureError extends Error {
  constructor(
    public readonly groupId: GroupId,
    message: string = `Keys for group ${groupId} have been erased`,
  ) {
    super(message);
    this.name = 'CryptoErasureError';
  }
}

export class CryptoErasureService {
  private erasedGroups = new Set<GroupId>();

  constructor(private keyStore: KeyStore) {}

  async eraseGroup(groupId: GroupId): Promise<ErasureAuditEntry> {
    const keyCount = await this.keyStore.deleteAllGroupKeys(groupId);
    this.erasedGroups.add(groupId);

    const auditEntry: ErasureAuditEntry = {
      groupId,
      timestamp: new Date(),
      keyCount,
    };

    console.log(
      `[CryptoErasure] Erased ${keyCount} keys for group ${groupId} at ${auditEntry.timestamp.toISOString()}`,
    );

    return auditEntry;
  }

  isErased(groupId: GroupId): boolean {
    return this.erasedGroups.has(groupId);
  }

  assertNotErased(groupId: GroupId): void {
    if (this.erasedGroups.has(groupId)) {
      throw new CryptoErasureError(groupId);
    }
  }
}
