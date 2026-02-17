import type { GroupId, UserId } from '@microchat/shared';

export interface SendMessageResult {
  messageId: string;
  timestamp: string;
}

export interface MessageListItem {
  id: string;
  groupId: GroupId;
  senderId: UserId;
  senderName: string;
  encryptedContent: string;
  createdAt: string;
  deleted: boolean;
}

interface ServerMessage {
  id: string;
  senderId: UserId;
  senderName: string;
  encryptedPayload: string;
  nonce: string;
  createdAt: string;
  deleted: boolean;
}

export class MessageClient {
  constructor(private baseUrl: string) {}

  async getMessages(
    groupId: GroupId,
    limit = 50,
    before?: string,
  ): Promise<MessageListItem[]> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (before) {
      params.set('before', before);
    }

    const response = await fetch(
      `${this.baseUrl}/api/groups/${groupId}/messages?${params}`,
      {
        method: 'GET',
        credentials: 'include',
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get messages');
    }

    const data = (await response.json()) as { messages: ServerMessage[] };

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

  async sendMessage(
    groupId: GroupId,
    encryptedContent: string,
    nonce?: string,
  ): Promise<SendMessageResult> {
    // For now, use a placeholder nonce if not provided (encryption not yet implemented)
    const messageNonce = nonce || crypto.randomUUID();

    const response = await fetch(
      `${this.baseUrl}/api/groups/${groupId}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encryptedPayload: encryptedContent,
          nonce: messageNonce,
        }),
        credentials: 'include',
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send message');
    }

    return response.json();
  }

  async deleteMessage(groupId: GroupId, messageId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/groups/${groupId}/messages/${messageId}`,
      {
        method: 'DELETE',
        credentials: 'include',
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete message');
    }
  }
}
