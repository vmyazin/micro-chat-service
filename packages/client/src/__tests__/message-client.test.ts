import { GroupCipher, MemoryKeyStore } from '@microchat/crypto';
import type { GroupId } from '@microchat/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageClient } from '../message-client';

// Track all fetch calls
let fetchCalls: Array<{ url: string; init: RequestInit }> = [];

function mockFetch(handlers: Record<string, () => Response>) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    fetchCalls.push({ url, init: init ?? {} });

    for (const [pattern, handler] of Object.entries(handlers)) {
      if (url.includes(pattern)) {
        return handler();
      }
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('MessageClient.sendImageMessage', () => {
  let client: MessageClient;
  const groupId = 'test-group-id' as GroupId;

  beforeEach(() => {
    fetchCalls = [];
    client = new MessageClient('http://localhost:8787');
  });

  it('uploads image blob then sends message payload with r2Key', async () => {
    const r2Key = 'groups/test-group-id/abc123.bin';

    globalThis.fetch = mockFetch({
      '/images': () => jsonResponse({ key: r2Key }),
      '/messages': () =>
        jsonResponse({ messageId: 'msg-1', timestamp: '2024-01-01T00:00:00Z' }),
    });

    const blob = new Blob([new Uint8Array(1024)], {
      type: 'application/octet-stream',
    });
    const result = await client.sendImageMessage(groupId, blob, 800, 600);

    expect(result.messageId).toBe('msg-1');
    expect(result.timestamp).toBe('2024-01-01T00:00:00Z');
    expect(result.r2Key).toBe(r2Key);

    // Verify the upload request
    expect(fetchCalls).toHaveLength(2);

    const uploadCall = fetchCalls[0];
    expect(uploadCall.url).toContain(`/api/groups/${groupId}/images`);
    expect(uploadCall.init.method).toBe('POST');
    expect(
      (uploadCall.init.headers as Record<string, string>)['Content-Type'],
    ).toBe('application/octet-stream');

    // Verify the message request contains the image payload
    const messageCall = fetchCalls[1];
    expect(messageCall.url).toContain(`/api/groups/${groupId}/messages`);
    expect(messageCall.init.method).toBe('POST');

    const messageBody = JSON.parse(messageCall.init.body as string);
    // encryptedPayload is the JSON-serialized MessagePayload (plaintext in dev mode)
    const payload = JSON.parse(messageBody.encryptedPayload);
    expect(payload.type).toBe('image');
    expect(payload.r2Key).toBe(r2Key);
    expect(payload.width).toBe(800);
    expect(payload.height).toBe(600);
    expect(payload.nonce).toBeDefined();
  });

  it('throws when image upload fails', async () => {
    globalThis.fetch = mockFetch({
      '/images': () => jsonResponse({ error: 'Image too large' }, 400),
    });

    const blob = new Blob([new Uint8Array(64)]);

    await expect(
      client.sendImageMessage(groupId, blob, 100, 100),
    ).rejects.toThrow('Image too large');

    // Should not have made the second request
    expect(fetchCalls).toHaveLength(1);
  });

  it('throws when message send fails after successful upload', async () => {
    const r2Key = 'groups/test-group-id/abc123.bin';

    globalThis.fetch = mockFetch({
      '/images': () => jsonResponse({ key: r2Key }),
      '/messages': () =>
        jsonResponse({ error: 'Not a member of this group' }, 403),
    });

    const blob = new Blob([new Uint8Array(64)]);

    await expect(
      client.sendImageMessage(groupId, blob, 100, 100),
    ).rejects.toThrow('Not a member of this group');

    // Both requests should have been made
    expect(fetchCalls).toHaveLength(2);
  });

  it('preserves width and height in the payload', async () => {
    globalThis.fetch = mockFetch({
      '/images': () => jsonResponse({ key: 'groups/g/img.bin' }),
      '/messages': () =>
        jsonResponse({ messageId: 'msg-2', timestamp: '2024-01-01T00:00:00Z' }),
    });

    const blob = new Blob([new Uint8Array(64)]);
    const result = await client.sendImageMessage(groupId, blob, 1920, 1080);

    expect(result.r2Key).toBe('groups/g/img.bin');

    const messageBody = JSON.parse(fetchCalls[1].init.body as string);
    const payload = JSON.parse(messageBody.encryptedPayload);
    expect(payload.width).toBe(1920);
    expect(payload.height).toBe(1080);
  });
});

describe('MessageClient.getMessages — decryption', () => {
  const groupId = 'test-group' as GroupId;

  async function makeEncryptedMessage(
    cipher: GroupCipher,
    plaintext: string,
    epoch: number,
  ) {
    const encrypted = await cipher.encrypt(groupId, epoch, plaintext);
    return { ciphertext: encrypted.ciphertext, nonce: encrypted.nonce };
  }

  it('decrypts messages when cipher and epoch are present', async () => {
    const keyStore = new MemoryKeyStore();
    const cipher = new GroupCipher(keyStore);
    await cipher.generateGroupKey(groupId, 1);

    const plaintext = JSON.stringify({ type: 'text', content: 'hello' });
    const { ciphertext, nonce } = await makeEncryptedMessage(cipher, plaintext, 1);

    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          messages: [
            {
              id: 'msg-1',
              senderId: 'u1',
              senderName: 'Alice',
              encryptedPayload: ciphertext,
              nonce,
              epoch: 1,
              createdAt: '2024-01-01T00:00:00Z',
              deleted: false,
              sealedSender: null,
            },
          ],
        }),
        { headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const client = new MessageClient('http://localhost:8787', cipher);
    const messages = await client.getMessages(groupId);

    expect(messages).toHaveLength(1);
    expect(messages[0].encryptedContent).toBe(plaintext);
    expect(messages[0].epoch).toBe(1);
  });

  it('leaves content as ciphertext when key is not available for that epoch', async () => {
    const cipher = new GroupCipher(new MemoryKeyStore());
    // No key stored — cipher has nothing for epoch 5

    // We need a valid-looking ciphertext; use a separate cipher to produce one
    const encryptCipher = new GroupCipher(new MemoryKeyStore());
    await encryptCipher.generateGroupKey(groupId, 5);
    const plaintext = 'secret';
    const { ciphertext, nonce } = await makeEncryptedMessage(encryptCipher, plaintext, 5);

    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          messages: [
            {
              id: 'msg-2',
              senderId: 'u1',
              senderName: 'Alice',
              encryptedPayload: ciphertext,
              nonce,
              epoch: 5,
              createdAt: '2024-01-01T00:00:00Z',
              deleted: false,
              sealedSender: null,
            },
          ],
        }),
        { headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const client = new MessageClient('http://localhost:8787', cipher);
    const messages = await client.getMessages(groupId);

    // Should fall back gracefully — raw ciphertext, not throw
    expect(messages[0].encryptedContent).toBe(ciphertext);
    expect(messages[0].epoch).toBe(5);
  });

  it('passes through content unchanged when no cipher is configured', async () => {
    const rawPayload = JSON.stringify({ type: 'text', content: 'plaintext' });

    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          messages: [
            {
              id: 'msg-3',
              senderId: 'u1',
              senderName: 'Alice',
              encryptedPayload: rawPayload,
              nonce: 'some-nonce',
              epoch: 0,
              createdAt: '2024-01-01T00:00:00Z',
              deleted: false,
              sealedSender: null,
            },
          ],
        }),
        { headers: { 'Content-Type': 'application/json' } },
      ),
    );

    // No cipher passed — development/unencrypted mode
    const client = new MessageClient('http://localhost:8787');
    const messages = await client.getMessages(groupId);

    expect(messages[0].encryptedContent).toBe(rawPayload);
  });

  it('maps epoch from server response into MessageListItem', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          messages: [
            {
              id: 'msg-4',
              senderId: 'u1',
              senderName: 'Alice',
              encryptedPayload: 'data',
              nonce: 'nonce',
              epoch: 7,
              createdAt: '2024-01-01T00:00:00Z',
              deleted: false,
              sealedSender: null,
            },
          ],
        }),
        { headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const client = new MessageClient('http://localhost:8787');
    const messages = await client.getMessages(groupId);

    expect(messages[0].epoch).toBe(7);
  });
});
