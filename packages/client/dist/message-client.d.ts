import type { GroupId, UserId } from '@microchat/shared';
export interface SendMessageResult {
    messageId: string;
    timestamp: string;
}
export interface MessageListItem {
    id: string;
    groupId: GroupId;
    senderId: UserId;
    encryptedContent: string;
    createdAt: string;
    deleted: boolean;
}
export declare class MessageClient {
    private baseUrl;
    constructor(baseUrl: string);
    getMessages(groupId: GroupId, limit?: number, before?: string): Promise<MessageListItem[]>;
    sendMessage(groupId: GroupId, encryptedContent: string): Promise<SendMessageResult>;
    deleteMessage(groupId: GroupId, messageId: string): Promise<void>;
}
//# sourceMappingURL=message-client.d.ts.map