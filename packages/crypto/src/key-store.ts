import type { GroupId } from '@microchat/shared';

export interface KeyMetadata {
  groupId: GroupId;
  epoch: number;
  createdAt: Date;
}

export interface StoredKey {
  key: Uint8Array;
  metadata: KeyMetadata;
}

export interface KeyStore {
  storeKey(groupId: GroupId, epoch: number, key: Uint8Array): Promise<void>;
  getKey(groupId: GroupId, epoch: number): Promise<StoredKey | null>;
  deleteKey(groupId: GroupId, epoch: number): Promise<boolean>;
  deleteAllGroupKeys(groupId: GroupId): Promise<number>;
}
