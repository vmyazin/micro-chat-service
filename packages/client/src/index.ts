// Re-export shared types for convenience
export type { GroupId, MessagePayload, UserId } from '@microchat/shared';
export { MAX_VOICE_DURATION_MS, MAX_VOICE_SIZE_BYTES } from '@microchat/shared';
export { uint8ArrayToBase64, base64ToUint8Array } from '@microchat/crypto';
export {
  AuthClient,
  type AuthResult,
  type CurrentUser,
  type LoginOptions,
  type RegisterOptions,
} from './auth-client';
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
  type SendMessageResult,
} from './message-client';
export {
  WebSocketClient,
  type WebSocketEvent,
  type WebSocketEventHandler,
} from './websocket-client';
