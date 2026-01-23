export type GroupId = string & {
    readonly __brand: 'GroupId';
};
export type UserId = string & {
    readonly __brand: 'UserId';
};
export interface EncryptedBlob {
    ciphertext: Uint8Array;
    nonce: Uint8Array;
}
export interface GroupMetadata {
    id: GroupId;
    createdAt: Date;
    memberCount: number;
    epochId: number;
}
export interface Message {
    id: string;
    groupId: GroupId;
    encryptedPayload: EncryptedBlob;
    timestamp: Date;
}
export declare enum RetentionPolicy {
    SEVEN_DAYS = "7_DAYS",
    GROUP_DISBAND = "GROUP_DISBAND"
}
//# sourceMappingURL=types.d.ts.map