'use client';

import type { GroupId } from '@microchat/client';
import { MicroChatClient, TreeKEMManager, type MicroChatClientOptions } from '@microchat/client';
import { GroupCipher, IndexedDBKeyStore, MemoryKeyStore } from '@microchat/crypto';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface ChatClientStore {
  client: MicroChatClient | null;
  callCipher: GroupCipher;
  messageCipher: GroupCipher;
  treekemManager: TreeKEMManager;
  ensureCallKey: (groupId: GroupId) => Promise<void>;
  getClient: (options?: MicroChatClientOptions) => MicroChatClient;
  clearClient: () => void;
}

// Call encryption setup - singleton instances
const callKeyStore = new MemoryKeyStore();
const callCipher = new GroupCipher(callKeyStore);
const initializedCallGroups = new Set<string>();

// Message encryption setup - singleton instances
const messageKeyStore = new IndexedDBKeyStore();
const messageCipher = new GroupCipher(messageKeyStore);
const treekemManager = new TreeKEMManager(messageCipher);

async function deriveCallGroupKey(groupId: GroupId): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(`microchat-call-key-${groupId}`),
  );
  return new Uint8Array(hashBuffer).slice(0, 32);
}

const createClient = (options?: MicroChatClientOptions) => {
  return new MicroChatClient({
    baseUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
    wsUrl: process.env.NEXT_PUBLIC_WS_URL,
    enableVoiceCalls: true,
    enableSealedSender: true,
    callCipher,
    messageCipher,
    treekemManager,
    getGroupEpoch: (gid: GroupId) => treekemManager.getEpoch(gid),
    ...options,
  });
};

export const useChatClientStore = create<ChatClientStore>()(
  devtools(
    (set, get) => ({
      client: null,
      callCipher,
      messageCipher,
      treekemManager,

      ensureCallKey: async (groupId: GroupId) => {
        if (initializedCallGroups.has(groupId)) {
          return;
        }

        const rawKey = await callCipher.getRawKey(groupId, 0);
        if (rawKey) {
          initializedCallGroups.add(groupId);
          return;
        }

        const derivedKey = await deriveCallGroupKey(groupId);
        await callCipher.importGroupKey(groupId, 0, derivedKey);
        initializedCallGroups.add(groupId);
      },

      getClient: (options) => {
        const current = get().client;
        if (current) {
          return current;
        }
        const client = createClient(options);
        set({ client }, false, 'getClient');
        return client;
      },

      clearClient: () => {
        const current = get().client;
        if (current) {
          current.disconnect();
        }
        set({ client: null }, false, 'clearClient');
      },
    }),
    { name: 'chat-client-store' }
  )
);
