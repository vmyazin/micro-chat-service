"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageClient = void 0;
class MessageClient {
    baseUrl;
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }
    async getMessages(groupId, limit = 50, before) {
        const params = new URLSearchParams({ limit: String(limit) });
        if (before) {
            params.set('before', before);
        }
        const response = await fetch(`${this.baseUrl}/api/groups/${groupId}/messages?${params}`, {
            method: 'GET',
            credentials: 'include',
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to get messages');
        }
        return response.json();
    }
    async sendMessage(groupId, encryptedContent) {
        const response = await fetch(`${this.baseUrl}/api/groups/${groupId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ encryptedContent }),
            credentials: 'include',
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to send message');
        }
        return response.json();
    }
    async deleteMessage(groupId, messageId) {
        const response = await fetch(`${this.baseUrl}/api/groups/${groupId}/messages/${messageId}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete message');
        }
    }
}
exports.MessageClient = MessageClient;
//# sourceMappingURL=message-client.js.map