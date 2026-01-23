import type { GroupId, Message, UserId } from '@microchat/shared';

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

export class MessageClient {
  constructor(private baseUrl: string) {}

  async getMessages(groupId: GroupId, limit = 50, before?: string): Promise<MessageListItem[]> {
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

  async sendMessage(groupId: GroupId, encryptedContent: string): Promise<SendMessageResult> {
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

  async deleteMessage(groupId: GroupId, messageId: string): Promise<void> {
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
