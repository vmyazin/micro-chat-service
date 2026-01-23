import type { GroupId, UserId } from '@microchat/shared';
export type WebSocketEvent = {
    type: 'message';
    groupId: GroupId;
    messageId: string;
    senderId: UserId;
    encryptedContent: string;
    timestamp: string;
} | {
    type: 'messageDeleted';
    groupId: GroupId;
    messageId: string;
    deletedBy: UserId;
} | {
    type: 'memberJoined';
    groupId: GroupId;
    userId: UserId;
    displayName: string;
} | {
    type: 'memberLeft';
    groupId: GroupId;
    userId: UserId;
} | {
    type: 'connected';
} | {
    type: 'disconnected';
} | {
    type: 'error';
    error: string;
};
export type WebSocketEventHandler = (event: WebSocketEvent) => void;
export declare class WebSocketClient {
    private baseUrl;
    private ws;
    private handlers;
    private reconnectTimeout;
    private reconnectAttempts;
    private maxReconnectAttempts;
    private reconnectDelayMs;
    private subscribedGroups;
    constructor(baseUrl: string);
    connect(): void;
    disconnect(): void;
    subscribe(groupId: GroupId): void;
    unsubscribe(groupId: GroupId): void;
    onEvent(handler: WebSocketEventHandler): () => void;
    private send;
    private sendSubscribe;
    private emit;
    private scheduleReconnect;
}
//# sourceMappingURL=websocket-client.d.ts.map