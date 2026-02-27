'use client';

import { useChatClientStore } from '@/stores/chat-client-store';
import type { GroupId, WebSocketEvent } from '@microchat/client';
import { generateECDHKeyPair } from '@microchat/crypto';
import type { ECKeyPair } from '@microchat/crypto';
import { useCallback, useEffect, useRef } from 'react';

const IDENTITY_KEY_STORAGE = 'microchat-identity-key';

/**
 * Store/retrieve a per-user ECDH identity key pair in localStorage.
 * The key pair is serialized as JSON with base64 raw key bytes.
 */
async function getOrCreateIdentityKey(): Promise<ECKeyPair> {
  const stored = localStorage.getItem(IDENTITY_KEY_STORAGE);
  if (stored) {
    const parsed = JSON.parse(stored) as {
      publicKey: string;
      privateKey: string;
    };
    const importParams: EcKeyImportParams = {
      name: 'ECDH',
      namedCurve: 'P-256',
    };
    const publicKey = await crypto.subtle.importKey(
      'raw',
      base64ToUint8(parsed.publicKey),
      importParams,
      true,
      [],
    );
    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      base64ToUint8(parsed.privateKey),
      importParams,
      true,
      ['deriveBits'],
    );
    return { publicKey, privateKey };
  }

  const keyPair = await generateECDHKeyPair();

  // Persist
  const pubRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', keyPair.publicKey),
  );
  const privPkcs8 = new Uint8Array(
    await crypto.subtle.exportKey('pkcs8', keyPair.privateKey),
  );
  localStorage.setItem(
    IDENTITY_KEY_STORAGE,
    JSON.stringify({
      publicKey: uint8ToBase64(pubRaw),
      privateKey: uint8ToBase64(privPkcs8),
    }),
  );

  return keyPair;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Hook that manages TreeKEM lifecycle for group encryption.
 *
 * - On group creation: initializes the ratchet tree and posts the update to server
 * - On treeUpdate WebSocket event: processes the update to sync local tree state
 * - On joining existing group: fetches tree state from server
 */
export function useTreeKEM() {
  const getClient = useChatClientStore((state) => state.getClient);
  const treekemManager = useChatClientStore((state) => state.treekemManager);
  const identityKeyRef = useRef<ECKeyPair | null>(null);

  // Lazily get or create identity key
  const getIdentityKey = useCallback(async (): Promise<ECKeyPair> => {
    if (identityKeyRef.current) return identityKeyRef.current;
    const key = await getOrCreateIdentityKey();
    identityKeyRef.current = key;
    return key;
  }, []);

  /**
   * Initialize TreeKEM for a newly created group.
   * Should be called right after createGroup().
   */
  const initGroupTree = useCallback(
    async (groupId: GroupId) => {
      const keyPair = await getIdentityKey();
      const pubRaw = new Uint8Array(
        await crypto.subtle.exportKey('raw', keyPair.publicKey),
      );

      const update = await treekemManager.initGroup(
        groupId,
        keyPair,
        pubRaw,
        [], // No other members yet at creation time
      );

      // Post tree update to server
      const client = getClient();
      await client.postTreeUpdate(groupId, update);
    },
    [treekemManager, getClient, getIdentityKey],
  );

  /**
   * Fetch existing tree state and join a group's TreeKEM session.
   * Should be called when joining an existing group or reconnecting.
   */
  const joinGroupTree = useCallback(
    async (groupId: GroupId, leafIndex: number) => {
      if (treekemManager.hasTree(groupId)) return;

      const client = getClient();
      const treeState = await client.getTreeState(groupId);
      if (!treeState) return; // No tree state yet (group hasn't initialized TreeKEM)

      const keyPair = await getIdentityKey();
      await treekemManager.joinGroup(
        groupId,
        treeState.treeData,
        leafIndex,
        keyPair,
      );
    },
    [treekemManager, getClient, getIdentityKey],
  );

  /**
   * Handle an incoming treeUpdate WebSocket event.
   */
  const handleTreeUpdate = useCallback(
    async (event: WebSocketEvent) => {
      if (event.type !== 'treeUpdate') return;

      if (!treekemManager.hasTree(event.groupId)) {
        // We don't have tree state for this group yet — might be a new joiner
        // The tree data is included in the event, so we can bootstrap from it
        return;
      }

      await treekemManager.processUpdate(
        event.groupId,
        event.updatePath,
        event.epoch,
      );
    },
    [treekemManager],
  );

  return {
    treekemManager,
    initGroupTree,
    joinGroupTree,
    handleTreeUpdate,
    getIdentityKey,
  };
}
