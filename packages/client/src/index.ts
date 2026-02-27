// Re-export shared types for convenience

export { base64ToUint8Array, uint8ArrayToBase64 } from '@microchat/crypto';
export type {
  CallId,
  CallState,
  GroupId,
  MessagePayload,
  UserId,
} from '@microchat/shared';
export {
  IMAGE_QUALITY,
  MAX_IMAGE_HEIGHT,
  MAX_IMAGE_SIZE_BYTES,
  MAX_IMAGE_WIDTH,
  MAX_VOICE_DURATION_MS,
  MAX_VOICE_SIZE_BYTES,
} from '@microchat/shared';
export {
  AuthClient,
  type AuthResult,
  type CurrentUser,
  type LoginOptions,
  type RegisterOptions,
} from './auth-client';
export {
  CallClient,
  type CallSession,
  type IncomingCallSession,
} from './call-client';
export {
  MicroChatClient,
  MicroChatClient as default,
  type MicroChatClientOptions,
} from './client';
export {
  type AcceptInviteResult,
  type CreateGroupResult,
  GroupClient,
  type GroupListItem,
  type GroupMember,
  type GroupMembersResult,
  type InviteResult,
} from './group-client';
export {
  MessageClient,
  type MessageListItem,
  type SendMessageOptions,
  type SendMessageResult,
} from './message-client';
export {
  SenderTokenStore,
  type SenderTokenStoreOptions,
} from './sender-token-store';
export {
  TreeKEMManager,
  type SerializedUpdate,
} from './treekem-manager';
export {
  WebSocketClient,
  type WebSocketEvent,
  type WebSocketEventHandler,
} from './websocket-client';
