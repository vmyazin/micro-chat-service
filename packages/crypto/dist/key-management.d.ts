export interface KeyStore {
    storeGroupKey(groupId: string, epoch: number, key: Uint8Array): Promise<void>;
    getGroupKey(groupId: string, epoch: number): Promise<Uint8Array | null>;
    eraseGroupKeys(groupId: string): Promise<void>;
}
//# sourceMappingURL=key-management.d.ts.map