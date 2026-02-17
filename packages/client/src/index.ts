// Re-export shared types for convenience
export type { GroupId, UserId } from '@microchat/shared';
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
