import type { GroupId } from '@microchat/shared';
import type { KeyStore } from './key-store';
export interface ErasureAuditEntry {
    groupId: GroupId;
    timestamp: Date;
    keyCount: number;
}
export declare class CryptoErasureError extends Error {
    readonly groupId: GroupId;
    constructor(groupId: GroupId, message?: string);
}
export declare class CryptoErasureService {
    private keyStore;
    private erasedGroups;
    constructor(keyStore: KeyStore);
    eraseGroup(groupId: GroupId): Promise<ErasureAuditEntry>;
    isErased(groupId: GroupId): boolean;
    assertNotErased(groupId: GroupId): void;
}
//# sourceMappingURL=crypto-erasure.d.ts.map