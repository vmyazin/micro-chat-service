import type { GroupId } from '@microchat/shared';
import type { KeyStore, StoredKey } from './key-store';
export declare class MemoryKeyStore implements KeyStore {
    private store;
    private makeKey;
    storeKey(groupId: GroupId, epoch: number, key: Uint8Array): Promise<void>;
    getKey(groupId: GroupId, epoch: number): Promise<StoredKey | null>;
    deleteKey(groupId: GroupId, epoch: number): Promise<boolean>;
    deleteAllGroupKeys(groupId: GroupId): Promise<number>;
}
//# sourceMappingURL=memory-key-store.d.ts.map