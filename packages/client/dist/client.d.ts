import type { GroupId, UserId } from '@microchat/shared';
import { type RegisterOptions, type LoginOptions, type AuthResult, type CurrentUser } from './auth-client';
import { type GroupListItem, type CreateGroupResult, type InviteResult, type AcceptInviteResult, type GroupMembersResult } from './group-client';
import { type SendMessageResult, type MessageListItem } from './message-client';
import { type WebSocketEventHandler } from './websocket-client';
export interface MicroChatClientOptions {
    baseUrl: string;
}
export declare class MicroChatClient {
    private authClient;
    private groupClient;
    private messageClient;
    private wsClient;
    constructor(options: MicroChatClientOptions);
    getRegisterOptions(displayName: string): Promise<RegisterOptions>;
    verifyRegistration(response: PublicKeyCredential, challenge: string): Promise<AuthResult>;
    getLoginOptions(username?: string): Promise<LoginOptions>;
    verifyLogin(response: PublicKeyCredential, challenge: string): Promise<AuthResult>;
    getCurrentUser(): Promise<CurrentUser>;
    listGroups(): Promise<GroupListItem[]>;
    createGroup(encryptedName: string): Promise<CreateGroupResult>;
    createInvite(groupId: GroupId): Promise<InviteResult>;
    acceptInvite(code: string): Promise<AcceptInviteResult>;
    removeMember(groupId: GroupId, userId: UserId): Promise<void>;
    getMembers(groupId: GroupId): Promise<GroupMembersResult>;
    leaveGroup(groupId: GroupId): Promise<void>;
    deleteGroup(groupId: GroupId): Promise<void>;
    getMessages(groupId: GroupId, limit?: number, before?: string): Promise<MessageListItem[]>;
    sendMessage(groupId: GroupId, encryptedContent: string): Promise<SendMessageResult>;
    deleteMessage(groupId: GroupId, messageId: string): Promise<void>;
    connect(): void;
    disconnect(): void;
    subscribe(groupId: GroupId): void;
    unsubscribe(groupId: GroupId): void;
    onEvent(handler: WebSocketEventHandler): () => void;
}
export default MicroChatClient;
//# sourceMappingURL=client.d.ts.map