import type { GroupId, UserId } from '@microchat/shared';
import { AuthClient, type RegisterOptions, type LoginOptions, type AuthResult } from './auth-client';
import {
  GroupClient,
  type GroupListItem,
  type CreateGroupResult,
  type InviteResult,
  type AcceptInviteResult,
  type GroupMember,
  type GroupMembersResult,
} from './group-client';
import {
  MessageClient,
  type SendMessageResult,
  type MessageListItem,
} from './message-client';
import {
  WebSocketClient,
  type WebSocketEvent,
  type WebSocketEventHandler,
} from './websocket-client';

export interface MicroChatClientOptions {
  baseUrl: string;
}

export class MicroChatClient {
  private authClient: AuthClient;
  private groupClient: GroupClient;
  private messageClient: MessageClient;
  private wsClient: WebSocketClient;

  constructor(options: MicroChatClientOptions) {
    this.authClient = new AuthClient(options.baseUrl);
    this.groupClient = new GroupClient(options.baseUrl);
    this.messageClient = new MessageClient(options.baseUrl);
    this.wsClient = new WebSocketClient(options.baseUrl);
  }

  // Auth methods
  getRegisterOptions(displayName: string): Promise<RegisterOptions> {
    return this.authClient.getRegisterOptions(displayName);
  }

  verifyRegistration(response: PublicKeyCredential, challenge: string): Promise<AuthResult> {
    return this.authClient.verifyRegistration(response, challenge);
  }

  getLoginOptions(username?: string): Promise<LoginOptions> {
    return this.authClient.getLoginOptions(username);
  }

  verifyLogin(response: PublicKeyCredential, challenge: string): Promise<AuthResult> {
    return this.authClient.verifyLogin(response, challenge);
  }

  // Group methods
  listGroups(): Promise<GroupListItem[]> {
    return this.groupClient.listGroups();
  }

  createGroup(encryptedName: string): Promise<CreateGroupResult> {
    return this.groupClient.createGroup(encryptedName);
  }

  createInvite(groupId: GroupId): Promise<InviteResult> {
    return this.groupClient.createInvite(groupId);
  }

  acceptInvite(code: string): Promise<AcceptInviteResult> {
    return this.groupClient.acceptInvite(code);
  }

  removeMember(groupId: GroupId, userId: UserId): Promise<void> {
    return this.groupClient.removeMember(groupId, userId);
  }

  getMembers(groupId: GroupId): Promise<GroupMembersResult> {
    return this.groupClient.getMembers(groupId);
  }

  leaveGroup(groupId: GroupId): Promise<void> {
    return this.groupClient.leaveGroup(groupId);
  }

  deleteGroup(groupId: GroupId): Promise<void> {
    return this.groupClient.deleteGroup(groupId);
  }

  // Message methods
  getMessages(groupId: GroupId, limit?: number, before?: string): Promise<MessageListItem[]> {
    return this.messageClient.getMessages(groupId, limit, before);
  }

  sendMessage(groupId: GroupId, encryptedContent: string): Promise<SendMessageResult> {
    return this.messageClient.sendMessage(groupId, encryptedContent);
  }

  deleteMessage(groupId: GroupId, messageId: string): Promise<void> {
    return this.messageClient.deleteMessage(groupId, messageId);
  }

  // WebSocket methods
  connect(): void {
    this.wsClient.connect();
  }

  disconnect(): void {
    this.wsClient.disconnect();
  }

  subscribe(groupId: GroupId): void {
    this.wsClient.subscribe(groupId);
  }

  unsubscribe(groupId: GroupId): void {
    this.wsClient.unsubscribe(groupId);
  }

  onEvent(handler: WebSocketEventHandler): () => void {
    return this.wsClient.onEvent(handler);
  }
}

export default MicroChatClient;
