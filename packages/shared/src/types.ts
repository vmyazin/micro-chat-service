export type GroupId = string & { readonly __brand: 'GroupId' };
export type UserId = string & { readonly __brand: 'UserId' };
export type CallId = string & { readonly __brand: 'CallId' };
export type CallState =
  | 'idle'
  | 'ringing-out'
  | 'ringing-in'
  | 'connecting'
  | 'active'
  | 'ended';
export type SealedSenderToken = string & {
  readonly __brand: 'SealedSenderToken';
};

export type RTCIceCandidateInit = {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
};

export interface EncryptedBlob {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
}

/**
 * Encrypted sender identity for Sealed Sender messages
 * The server cannot see who sent the message; only group members can decrypt this
 */
export interface SealedSenderPayload {
  senderId: UserId;
  senderName: string;
  timestamp: string;
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

export type MessagePayload =
  | { type: 'text'; content: string }
  | { type: 'audio'; data: string; duration: number; mimeType: string }
  | {
      type: 'image';
      r2Key: string;
      nonce: string;
      width: number;
      height: number;
    };

export type WebSocketEvent =
  | {
      type: 'message';
      groupId: GroupId;
      messageId: string;
      senderId: UserId | null;
      senderName: string | null;
      encryptedContent: string;
      timestamp: string;
      /** Encrypted sender identity for Sealed Sender messages */
      sealedSender?: string;
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
  | {
      type: 'callOffer';
      groupId: GroupId;
      callId: CallId;
      toUserId: UserId;
      fromUserId: UserId | null;
      senderToken?: SealedSenderToken;
      sealedSender?: string;
      sdp: string;
      timestamp: string;
    }
  | {
      type: 'callAnswer';
      groupId: GroupId;
      callId: CallId;
      fromUserId: UserId | null;
      sealedSender?: string;
      sdp: string;
    }
  | {
      type: 'iceCandidate';
      groupId: GroupId;
      callId: CallId;
      fromUserId: UserId | null;
      sealedSender?: string;
      candidate: RTCIceCandidateInit;
    }
  | {
      type: 'callEnd';
      groupId: GroupId;
      callId: CallId;
      fromUserId: UserId | null;
      sealedSender?: string;
      reason: 'hangup' | 'rejected' | 'missed' | 'error';
    }
  | { type: 'callRinging'; groupId: GroupId; callId: CallId }
  | { type: 'connected' }
  | { type: 'disconnected' }
  | { type: 'error'; error: string };
