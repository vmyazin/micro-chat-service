import type { EncryptedMessage, GroupCipher } from '@microchat/crypto';
import { uint8ArrayToBase64 } from '@microchat/crypto';
import type { GroupId, MessagePayload, UserId } from '@microchat/shared';
import type { SenderTokenStore } from './sender-token-store';

export interface SendMessageResult {
  messageId: string;
  timestamp: string;
}

export interface MessageListItem {
  id: string;
  groupId: GroupId;
  senderId: UserId | null;
  senderName: string | null;
  encryptedContent: string;
  createdAt: string;
  deleted: boolean;
  sealedSender?: string;
}

interface ServerMessage {
  id: string;
  senderId: UserId | null;
  senderName: string | null;
  encryptedPayload: string;
  nonce: string;
  epoch?: number;
  createdAt: string;
  deleted: boolean;
  sealedSender?: string;
}

export interface SendMessageOptions {
  /** Use Sealed Sender to hide identity from server (default: false) */
  sealedSender?: boolean;
  /** User ID for creating encrypted sender identity (required if sealedSender=true) */
  senderId?: UserId;
  /** Sender display name for creating encrypted sender identity (required if sealedSender=true) */
  senderName?: string;
}

export class MessageClient {
  private cipher: GroupCipher | null;

  constructor(
    private baseUrl: string,
    cipher?: GroupCipher,
    private tokenStore?: SenderTokenStore,
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
      sealedSender: msg.sealedSender,
    }));
  }

  async sendMessage(
    groupId: GroupId,
    content: string,
    epoch?: number,
    options?: SendMessageOptions,
  ): Promise<SendMessageResult> {
    const payload: MessagePayload = { type: 'text', content };
    return this.sendPayload(groupId, JSON.stringify(payload), epoch, options);
  }

  async sendVoiceMessage(
    groupId: GroupId,
    audioBlob: Blob,
    duration: number,
    epoch?: number,
    options?: SendMessageOptions,
  ): Promise<SendMessageResult> {
    const buffer = await audioBlob.arrayBuffer();
    const base64 = uint8ArrayToBase64(new Uint8Array(buffer));
    const payload: MessagePayload = {
      type: 'audio',
      data: base64,
      duration,
      mimeType: audioBlob.type,
    };
    return this.sendPayload(groupId, JSON.stringify(payload), epoch, options);
  }

  async sendImageMessage(
    groupId: GroupId,
    encryptedBlob: Blob,
    width: number,
    height: number,
    epoch?: number,
    options?: SendMessageOptions,
  ): Promise<SendMessageResult & { r2Key: string }> {
    // Upload encrypted image to R2 via server
    const uploadResponse = await fetch(
      `${this.baseUrl}/api/groups/${groupId}/images`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: encryptedBlob,
        credentials: 'include',
      },
    );

    if (!uploadResponse.ok) {
      const error = await uploadResponse.json();
      throw new Error(
        (error as { error?: string }).error || 'Failed to upload image',
      );
    }

    const { key: r2Key } = (await uploadResponse.json()) as { key: string };

    // Build message payload referencing the R2 key
    const nonce = crypto.randomUUID();
    const payload: MessagePayload = {
      type: 'image',
      r2Key,
      nonce,
      width,
      height,
    };

    const result = await this.sendPayload(
      groupId,
      JSON.stringify(payload),
      epoch,
      options,
    );

    return { ...result, r2Key };
  }

  private async sendPayload(
    groupId: GroupId,
    serialized: string,
    epoch?: number,
    options?: SendMessageOptions,
  ): Promise<SendMessageResult> {
    let encryptedPayload: string;
    let nonce: string;

    if (this.cipher && epoch !== undefined) {
      const encrypted: EncryptedMessage = await this.cipher.encrypt(
        groupId,
        epoch,
        serialized,
      );
      encryptedPayload = encrypted.ciphertext;
      nonce = encrypted.nonce;
    } else {
      // Fallback: no cipher configured, send plaintext (development only)
      encryptedPayload = serialized;
      nonce = crypto.randomUUID();
    }

    // Build request body
    const requestBody: Record<string, unknown> = {
      encryptedPayload,
      nonce,
      epoch,
    };

    // Handle Sealed Sender
    const useSealedSender = options?.sealedSender ?? false;
    if (useSealedSender && this.tokenStore) {
      // Get an anonymous token
      const token = await this.tokenStore.getToken(groupId);
      if (!token) {
        throw new Error(
          'No sender tokens available. Try again or use regular send.',
        );
      }
      requestBody.senderToken = token;

      // Encrypt sender identity if cipher is available
      if (
        this.cipher &&
        epoch !== undefined &&
        options?.senderId &&
        options?.senderName
      ) {
        const sealedSenderData = await this.tokenStore.encryptSenderIdentity(
          options.senderId,
          options.senderName,
          this.cipher,
          groupId,
          epoch,
        );
        requestBody.sealedSender = sealedSenderData;
      }
    }

    const response = await fetch(
      `${this.baseUrl}/api/groups/${groupId}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
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
