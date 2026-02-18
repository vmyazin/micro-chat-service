export type GroupId = string & { readonly __brand: 'GroupId' };
export type UserId = string & { readonly __brand: 'UserId' };

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

export enum RetentionPolicy {
  SEVEN_DAYS = '7_DAYS',
  GROUP_DISBAND = 'GROUP_DISBAND',
}

export interface User {
  id: UserId;
  displayName: string;
  createdAt: Date;
}

export interface Session {
  id: string;
  userId: UserId;
  expiresAt: Date;
  deviceInfo: string;
}

export interface WebAuthnCredential {
  credentialId: string;
  publicKey: string;
  userId: UserId;
  createdAt: Date;
}

export interface GroupInvite {
  id: string;
  groupId: GroupId;
  createdBy: UserId;
  expiresAt: Date;
  used: boolean;
}

export interface DeletedMessage {
  id: string;
  groupId: GroupId;
  deletedAt: Date;
  deletedBy: UserId;
}

export const InviteConfig = {
  MAX_AGE_DAYS: 7,
  SINGLE_USE: true,
} as const;

export type WebSocketEvent =
  | {
      type: 'message';
      groupId: GroupId;
      messageId: string;
      senderId: UserId;
      senderName: string;
      encryptedContent: string;
      timestamp: string;
    }
  | {
      type: 'messageDeleted';
      groupId: GroupId;
      messageId: string;
      deletedBy: UserId;
    }
  | {
      type: 'memberJoined';
      groupId: GroupId;
      userId: UserId;
      displayName: string;
    }
  | { type: 'memberLeft'; groupId: GroupId; userId: UserId }
  | { type: 'connected' }
  | { type: 'disconnected' }
  | { type: 'error'; error: string };
