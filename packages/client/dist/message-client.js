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
        const data = await response.json();
        // Map server response to client format
        return data.messages.map((msg) => ({
            id: msg.id,
            groupId,
            senderId: msg.senderId,
            senderName: msg.senderName,
            encryptedContent: msg.encryptedPayload,
            createdAt: msg.createdAt,
            deleted: msg.deleted,
        }));
    }
    async sendMessage(groupId, encryptedContent, nonce) {
        // For now, use a placeholder nonce if not provided (encryption not yet implemented)
        const messageNonce = nonce || crypto.randomUUID();
        const response = await fetch(`${this.baseUrl}/api/groups/${groupId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ encryptedPayload: encryptedContent, nonce: messageNonce }),
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