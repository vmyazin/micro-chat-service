import type { GroupId, UserId } from '@microchat/shared';

export type WebSocketEvent =
  | { type: 'message'; groupId: GroupId; messageId: string; senderId: UserId; encryptedContent: string; timestamp: string }
  | { type: 'messageDeleted'; groupId: GroupId; messageId: string; deletedBy: UserId }
  | { type: 'memberJoined'; groupId: GroupId; userId: UserId; displayName: string }
  | { type: 'memberLeft'; groupId: GroupId; userId: UserId }
  | { type: 'connected' }
  | { type: 'disconnected' }
  | { type: 'error'; error: string };

export type WebSocketEventHandler = (event: WebSocketEvent) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private handlers: Set<WebSocketEventHandler> = new Set();
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelayMs = 1000;
  private subscribedGroups: Set<GroupId> = new Set();

  constructor(private baseUrl: string) {}

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    const wsUrl = this.baseUrl.replace(/^http/, 'ws') + '/ws';
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.emit({ type: 'connected' });

      for (const groupId of this.subscribedGroups) {
        this.sendSubscribe(groupId);
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit(data);
      } catch {
        this.emit({ type: 'error', error: 'Failed to parse WebSocket message' });
      }
    };

    this.ws.onclose = () => {
      this.emit({ type: 'disconnected' });
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.emit({ type: 'error', error: 'WebSocket error' });
    };
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.subscribedGroups.clear();
  }

  subscribe(groupId: GroupId): void {
    this.subscribedGroups.add(groupId);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscribe(groupId);
    }
  }

  unsubscribe(groupId: GroupId): void {
    this.subscribedGroups.delete(groupId);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({ action: 'unsubscribe', groupId });
    }
  }

  onEvent(handler: WebSocketEventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private send(data: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private sendSubscribe(groupId: GroupId): void {
    this.send({ action: 'subscribe', groupId });
  }

  private emit(event: WebSocketEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch {
        // Ignore handler errors
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit({ type: 'error', error: 'Max reconnect attempts reached' });
      return;
    }

    const delay = this.reconnectDelayMs * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }
}
