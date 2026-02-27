'use client';

import { useChatClientStore } from '@/stores/chat-client-store';
import type { GroupId, WebSocketEvent } from '@microchat/client';
import { generateECDHKeyPair } from '@microchat/crypto';
import type { ECKeyPair } from '@microchat/crypto';
import { useCallback, useRef } from 'react';

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
      base64ToUint8(parsed.publicKey) as any,
      importParams,
      true,
      [],
    );
    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      base64ToUint8(parsed.privateKey) as any,
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
 * - On group creation: initializes the ratchet tree and posts the commit to server
 * - On treeUpdate WebSocket event: processes the commit to sync local tree state
 * - On joining existing group: fetches tree state from server or uses Welcome
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
        [],
      );

      // Post commit to server
      const client = getClient();
      await client.postTreeUpdate(groupId, update);
    },
    [treekemManager, getClient, getIdentityKey],
  );

  /**
   * Fetch existing tree state and join a group's TreeKEM session.
   * Uses Welcome message if available, falls back to tree state fetch.
   */
  /**
   * Bootstrap tree for a group. Tries welcome (passed or fetched), falls back to legacy tree state.
   */
  const joinGroupTree = useCallback(
    async (groupId: GroupId, leafIndex?: number, welcomeJson?: string) => {
      if (treekemManager.hasTree(groupId)) return;

      const keyPair = await getIdentityKey();

      if (welcomeJson) {
        await treekemManager.joinFromWelcome(groupId, welcomeJson, keyPair);
        return;
      }

      // Fetch tree state from server — includes welcome if available
      const client = getClient();
      const treeState = await client.getTreeState(groupId);

      if (treeState?.welcome) {
        await treekemManager.joinFromWelcome(groupId, treeState.welcome, keyPair);
        return;
      }

      if (treeState && treeState.epoch > 0) {
        // No welcome on the server — this is the group creator's case.
        // initGroupTree never generates a Welcome (solo init), so welcome_data
        // is always null. If in-memory state was lost (hot reload, Strict Mode
        // double-mount), reconstruct the MLSGroup from the persisted treeData.
        // The epoch key is already in IndexedDB from the original create/commit.
        // leafIndex=0 because the creator is always the first leaf.
        await treekemManager.restoreFromTreeData(
          groupId,
          treeState.treeData,
          treeState.epoch,
          0,
          keyPair,
          treeState.commit ?? undefined,
        );
        return;
      }

      // No tree state at all yet — leave uninitialized; handleTreeUpdate will
      // bootstrap when the treeUpdate WebSocket event arrives with a welcome.
    },
    [treekemManager, getClient, getIdentityKey],
  );

  /**
   * Handle an incoming treeUpdate WebSocket event.
   * - New joiner (no tree, or epoch=0 from legacy fallback): joinFromWelcome if welcome present.
   * - Existing member at epoch>0: processCommit to advance epoch.
   */
  const handleTreeUpdate = useCallback(
    async (event: WebSocketEvent) => {
      if (event.type !== 'treeUpdate') return;

      const hasTree = treekemManager.hasTree(event.groupId);
      const currentEpoch = treekemManager.getEpoch(event.groupId); // 0 if no tree

      console.debug(
        `[TreeKEM] treeUpdate groupId=${event.groupId} epoch=${event.epoch} hasTree=${hasTree} currentEpoch=${currentEpoch} hasWelcome=${!!event.welcome}`,
      );

      if (event.welcome && (!hasTree || currentEpoch === 0)) {
        // No tree yet, or tree was bootstrapped via legacy path (epoch 0) —
        // use the proper Welcome to derive the correct epoch key.
        const keyPair = await getIdentityKey();
        try {
          await treekemManager.joinFromWelcome(event.groupId, event.welcome, keyPair);
          console.debug(
            `[TreeKEM] joinFromWelcome SUCCESS groupId=${event.groupId} newEpoch=${treekemManager.getEpoch(event.groupId)}`,
          );
        } catch (err) {
          console.error(`[TreeKEM] joinFromWelcome FAILED groupId=${event.groupId}`, err);
          throw err;
        }
        return;
      }

      if (hasTree) {
        // Skip if we're already at this epoch — means we were the committer
        if (currentEpoch >= event.epoch) {
          console.debug(
            `[TreeKEM] skipping treeUpdate (already at epoch ${currentEpoch})`,
          );
          return;
        }
        try {
          await treekemManager.processCommit(event.groupId, event.commit);
          console.debug(
            `[TreeKEM] processCommit SUCCESS groupId=${event.groupId} newEpoch=${treekemManager.getEpoch(event.groupId)}`,
          );
        } catch (err) {
          console.error(`[TreeKEM] processCommit FAILED groupId=${event.groupId}`, err);
          throw err;
        }
      }
    },
    [treekemManager, getIdentityKey],
  );

  /**
   * Add a new member to the group tree, generating a Welcome for them.
   * Called by the existing member who receives memberJoined with a keyPackage.
   * Retries up to 3 times on 409 epoch conflicts by re-joining from server state.
   */
  const addMemberToTree = useCallback(
    async (
      groupId: GroupId,
      keyPackage: { publicKey: string; credential: string },
    ) => {
      if (!treekemManager.hasTree(groupId)) return;

      // Import public key from base64 raw bytes
      const pubBytes = base64ToUint8(keyPackage.publicKey);
      const publicKey = await crypto.subtle.importKey(
        'raw',
        pubBytes.buffer as ArrayBuffer,
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        [],
      );
      const credential = base64ToUint8(keyPackage.credential);

      const client = getClient();
      const MAX_RETRIES = 3;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        if (!treekemManager.hasTree(groupId)) {
          // Re-join from server state before retrying
          await joinGroupTree(groupId);
          if (!treekemManager.hasTree(groupId)) {
            console.warn(`[TreeKEM] addMemberToTree: cannot re-join group ${groupId}`);
            return;
          }
        }

        const result = await treekemManager.addMember(groupId, { publicKey, credential });

        try {
          // Post commit + welcome so the server broadcasts treeUpdate to all members.
          // The welcome is included so the new joiner can bootstrap via joinFromWelcome.
          await client.postTreeUpdate(groupId, result);
          return;
        } catch (err) {
          const isConflict = (err as { status?: number }).status === 409;
          if (!isConflict || attempt >= MAX_RETRIES - 1) {
            throw err;
          }
          console.warn(
            `[TreeKEM] addMemberToTree: epoch conflict (attempt ${attempt + 1}), re-syncing...`,
          );
          // Reset local tree state so joinGroupTree re-fetches from server on next iteration
          treekemManager.deleteGroup(groupId);
        }
      }
    },
    [treekemManager, getClient, joinGroupTree],
  );

  return {
    treekemManager,
    initGroupTree,
    joinGroupTree,
    handleTreeUpdate,
    addMemberToTree,
    getIdentityKey,
  };
}
