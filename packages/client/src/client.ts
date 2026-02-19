import type { GroupId, UserId } from '@microchat/shared';
import {
  AuthClient,
  type AuthResult,
  type CurrentUser,
  type LoginOptions,
  type RegisterOptions,
} from './auth-client';
import {
  type AcceptInviteResult,
  type CreateGroupResult,
  GroupClient,
  type GroupListItem,
  type GroupMembersResult,
  type InviteResult,
} from './group-client';
import {
  MessageClient,
  type MessageListItem,
  type SendMessageOptions,
  type SendMessageResult,
} from './message-client';
import {
  SenderTokenStore,
  type SenderTokenStoreOptions,
} from './sender-token-store';
import {
  WebSocketClient,
  type WebSocketEventHandler,
} from './websocket-client';

export interface MicroChatClientOptions {
  baseUrl: string;
  wsUrl?: string;
  /** Enable Sealed Sender for anonymous message sending */
  enableSealedSender?: boolean;
  /** Options for sender token management */
  senderTokenOptions?: SenderTokenStoreOptions;
}

export class MicroChatClient {
  private authClient: AuthClient;
  private groupClient: GroupClient;
  private messageClient: MessageClient;
  private wsClient: WebSocketClient;
  private senderTokenStore?: SenderTokenStore;

  constructor(options: MicroChatClientOptions) {
    this.authClient = new AuthClient(options.baseUrl);
    this.groupClient = new GroupClient(options.baseUrl);
    this.senderTokenStore = options.enableSealedSender
      ? new SenderTokenStore(
          options.senderTokenOptions ?? { baseUrl: options.baseUrl },
        )
      : undefined;
    this.messageClient = new MessageClient(
      options.baseUrl,
      undefined,
      this.senderTokenStore,
    );
    this.wsClient = new WebSocketClient(options.wsUrl ?? options.baseUrl);
  }

  // Auth methods
  getRegisterOptions(displayName: string): Promise<RegisterOptions> {
    return this.authClient.getRegisterOptions(displayName);
  }

  verifyRegistration(
    response: PublicKeyCredential,
    challenge: string,
  ): Promise<AuthResult> {
    return this.authClient.verifyRegistration(response, challenge);
  }

  getLoginOptions(username?: string): Promise<LoginOptions> {
    return this.authClient.getLoginOptions(username);
  }

  verifyLogin(
    response: PublicKeyCredential,
    challenge: string,
  ): Promise<AuthResult> {
    return this.authClient.verifyLogin(response, challenge);
  }

  getCurrentUser(): Promise<CurrentUser> {
    return this.authClient.getCurrentUser();
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
  getMessages(
    groupId: GroupId,
    limit?: number,
    before?: string,
  ): Promise<MessageListItem[]> {
    return this.messageClient.getMessages(groupId, limit, before);
  }

  sendMessage(
    groupId: GroupId,
    encryptedContent: string,
    epoch?: number,
    options?: SendMessageOptions,
  ): Promise<SendMessageResult> {
    return this.messageClient.sendMessage(
      groupId,
      encryptedContent,
      epoch,
      options,
    );
  }

  sendVoiceMessage(
    groupId: GroupId,
    audioBlob: Blob,
    duration: number,
    epoch?: number,
    options?: SendMessageOptions,
  ): Promise<SendMessageResult> {
    return this.messageClient.sendVoiceMessage(
      groupId,
      audioBlob,
      duration,
      epoch,
      options,
    );
  }

  deleteMessage(groupId: GroupId, messageId: string): Promise<void> {
    return this.messageClient.deleteMessage(groupId, messageId);
  }

  // Sealed Sender methods
  async prefetchSenderTokens(groupId: GroupId): Promise<void> {
    if (!this.senderTokenStore) {
      throw new Error(
        'Sealed Sender not enabled. Set enableSealedSender: true in options.',
      );
    }
    await this.senderTokenStore.prefetchTokens(groupId);
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
