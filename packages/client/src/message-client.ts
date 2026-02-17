import type { EncryptedMessage, GroupCipher } from '@microchat/crypto';
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
  epoch?: number;
  createdAt: string;
  deleted: boolean;
}

export class MessageClient {
  private cipher: GroupCipher | null;

  constructor(
    private baseUrl: string,
    cipher?: GroupCipher,
  ) {
    this.cipher = cipher ?? null;
  }

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
    content: string,
    epoch?: number,
  ): Promise<SendMessageResult> {
    let encryptedPayload: string;
    let nonce: string;

    if (this.cipher && epoch !== undefined) {
      const encrypted: EncryptedMessage = await this.cipher.encrypt(
        groupId,
        epoch,
        content,
      );
      encryptedPayload = encrypted.ciphertext;
      nonce = encrypted.nonce;
    } else {
      // Fallback: no cipher configured, send plaintext (development only)
      encryptedPayload = content;
      nonce = crypto.randomUUID();
    }

    const response = await fetch(
      `${this.baseUrl}/api/groups/${groupId}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encryptedPayload,
          nonce,
          epoch,
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

  async decryptMessage(
    groupId: GroupId,
    message: MessageListItem,
    epoch: number,
  ): Promise<string> {
    if (!this.cipher) {
      // No cipher: return as-is (development mode)
      return message.encryptedContent;
    }

    return this.cipher.decrypt(groupId, {
      ciphertext: message.encryptedContent,
      nonce: message.encryptedContent, // nonce is not in MessageListItem yet
      epoch,
    });
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
