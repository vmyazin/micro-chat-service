"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketClient = void 0;
class WebSocketClient {
    baseUrl;
    ws = null;
    handlers = new Set();
    reconnectTimeout = null;
    reconnectAttempts = 0;
    maxReconnectAttempts = 5;
    reconnectDelayMs = 1000;
    subscribedGroups = new Set();
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }
    connect() {
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
            }
            catch {
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
    disconnect() {
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
    subscribe(groupId) {
        this.subscribedGroups.add(groupId);
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.sendSubscribe(groupId);
        }
    }
    unsubscribe(groupId) {
        this.subscribedGroups.delete(groupId);
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.send({ action: 'unsubscribe', groupId });
        }
    }
    onEvent(handler) {
        this.handlers.add(handler);
        return () => this.handlers.delete(handler);
    }
    send(data) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }
    sendSubscribe(groupId) {
        this.send({ action: 'subscribe', groupId });
    }
    emit(event) {
        for (const handler of this.handlers) {
            try {
                handler(event);
            }
            catch {
                // Ignore handler errors
            }
        }
    }
    scheduleReconnect() {
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
exports.WebSocketClient = WebSocketClient;
//# sourceMappingURL=websocket-client.js.map