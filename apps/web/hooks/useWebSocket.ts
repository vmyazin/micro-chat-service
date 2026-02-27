'use client';

import { messagesQueryKey } from '@/hooks/useMessages';
import { membersQueryKey } from '@/hooks/useMembers';
import { invalidateGroups } from '@/hooks/useGroups';
import { useChatClientStore } from '@/stores/chat-client-store';
import { useChatStore } from '@/stores/chat-store';
import { usePresenceStore } from '@/stores/presence-store';
import type { GroupId, MessageListItem, WebSocketEvent, UserId } from '@microchat/client';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useCallback } from 'react';
import { useGroups } from '@/hooks/useGroups';
import { useTreeKEM } from '@/hooks/useTreeKEM';

export function useWebSocket(activeGroupId?: GroupId | null) {
  const client = useChatClientStore((state) => state.client);
  const getClient = useChatClientStore((state) => state.getClient);
  const queryClient = useQueryClient();
  const { data: groups } = useGroups();
  const { handleTreeUpdate, addMemberToTree, treekemManager, joinGroupTree } = useTreeKEM();

  const setConnectionStatus = useChatStore((state) => state.setConnectionStatus);

  // Track the primary active group (for subscription management)
  const activeGroupRef = useRef<GroupId | null>(null);
  // Track the currently viewed group (for invalidation guard)
  const activeGroupIdRef = useRef<GroupId | null>(activeGroupId ?? null);
  const treeUpdateChainRef = useRef<Map<GroupId, Promise<void>>>(new Map());
  const addMemberInFlightRef = useRef<Set<string>>(new Set());

  // Keep ref current so the finally() closure sees the latest value
  useEffect(() => {
    activeGroupIdRef.current = activeGroupId ?? null;
  }, [activeGroupId]);

  const enqueueTreeUpdate = useCallback(
    (event: Extract<WebSocketEvent, { type: 'treeUpdate' }>) => {
      const chainMap = treeUpdateChainRef.current;
      const prev = chainMap.get(event.groupId) ?? Promise.resolve();

      const next = prev
        .catch(() => {
          // Keep queue processing even after failures.
        })
        .then(async () => {
          await handleTreeUpdate(event);
        });

      chainMap.set(event.groupId, next);
      next
        .catch(console.error)
        .finally(() => {
          // Only invalidate when this is the LAST queued update (coalesces burst)
          // and only for the group being actively viewed.
          if (chainMap.get(event.groupId) === next) {
            chainMap.delete(event.groupId);
            if (event.groupId === activeGroupIdRef.current) {
              queryClient.invalidateQueries({
                queryKey: messagesQueryKey(event.groupId),
              });
            }
          }
        });
    },
    [handleTreeUpdate, queryClient],
  );

  // Memoize the event handler with stable dependencies
  const handleEvent = useCallback(async (event: WebSocketEvent) => {
    switch (event.type) {
      case 'connected':
        setConnectionStatus('connected');
        break;

      case 'disconnected':
        setConnectionStatus('reconnecting');
        break;

      case 'error':
        setConnectionStatus('disconnected');
        break;

      case 'message': {
        // Attempt decryption before caching
        let content = event.encryptedContent;
        if (event.nonce && event.epoch !== undefined) {
          const { messageCipher } = useChatClientStore.getState();
          const hasKey = treekemManager.hasTree(event.groupId);
          const currentEpoch = treekemManager.getEpoch(event.groupId);
          console.debug(
            `[WS] message groupId=${event.groupId} msgEpoch=${event.epoch} treeEpoch=${currentEpoch} hasTree=${hasKey} sender=${event.senderId}`,
          );
          try {
            content = await messageCipher.decrypt(event.groupId, {
              ciphertext: event.encryptedContent,
              nonce: event.nonce,
              epoch: event.epoch,
            });
          } catch (err) {
            console.warn(
              `[WS] decrypt FAILED groupId=${event.groupId} epoch=${event.epoch}`,
              err instanceof Error ? err.message : err,
            );
            // Key not available — leave as ciphertext
          }
        }

        // Add new message to the cache immediately
        const newMessage: MessageListItem = {
          id: event.messageId,
          groupId: event.groupId,
          senderId: event.senderId,
          senderName: event.senderName,
          encryptedContent: content,
          nonce: event.nonce,
          epoch: event.epoch,
          createdAt: event.timestamp,
          deleted: false,
          sealedSender: event.sealedSender,
        };

        queryClient.setQueryData(
          messagesQueryKey(event.groupId),
          (old: MessageListItem[] | undefined) => {
            if (!old) return [newMessage];
            // Check if message already exists
            if (old.some((m) => m.id === event.messageId)) {
              return old;
            }
            return [...old, newMessage];
          }
        );
        
        // Auto-ack the message delivery for the new Ephemeral Storage logic
        // Only if it's not from us (the server already knows we sent it if we're connected)
        // Note: we'd need to know the current user's ID. Let's pass it in or pull from store if we can.
        // For sealed sender, the senderId is null, so it will always send a receipt.
        
        const user = queryClient.getQueryData<{ userId: string; displayName: string }>(['currentUser']);
        if (user && user.userId !== event.senderId) {
          getClient().sendDeliveryReceipt(event.groupId, event.messageId, user.userId as UserId);
        }

        break;
      }

      case 'messageDeleted': {
        // Update message in cache to mark as deleted
        queryClient.setQueryData(
          messagesQueryKey(event.groupId),
          (old: MessageListItem[] | undefined) => {
            if (!old) return old;
            return old.map((msg) =>
              msg.id === event.messageId ? { ...msg, deleted: true } : msg
            );
          }
        );
        break;
      }

      case 'memberJoined':
      case 'memberLeft': {
        // Invalidate members list and groups list
        queryClient.invalidateQueries({
          queryKey: membersQueryKey(event.groupId),
        });
        queryClient.invalidateQueries({
          queryKey: invalidateGroups(),
        });
        // If an existing member (we have a tree) sees a new joiner with a key package,
        // run addMember to generate a Welcome so they can derive the correct epoch key.
        if (
          event.type === 'memberJoined' &&
          event.keyPackage &&
          treekemManager.hasTree(event.groupId)
        ) {
          const dedupeKey = `${event.groupId}:${event.userId}`;
          if (!addMemberInFlightRef.current.has(dedupeKey)) {
            addMemberInFlightRef.current.add(dedupeKey);
            addMemberToTree(event.groupId, event.keyPackage)
              .catch(console.error)
              .finally(() => {
                addMemberInFlightRef.current.delete(dedupeKey);
              });
          }
        }
        break;
      }

      case 'treeUpdate': {
        enqueueTreeUpdate(event);
        break;
      }

      // Call events are handled by CallClient internally - don't process here
      case 'callOffer':
      case 'callAnswer':
      case 'callEnd':
      case 'callRinging':
      case 'iceCandidate': {
        break;
      }

      case 'presenceUpdate': {
        if (event.status === 'online') {
          usePresenceStore.getState().setUserOnline(event.groupId, event.userId);
        } else {
          usePresenceStore.getState().setUserOffline(event.groupId, event.userId);
        }
        break;
      }
    }
  }, [
    queryClient,
    setConnectionStatus,
    enqueueTreeUpdate,
    addMemberToTree,
    treekemManager,
  ]);

  useEffect(() => {
    const c = client ?? getClient();
    
    // Connect universally
    c.connect();

    // Subscribe to all available groups the user is a member of
    if (groups) {
      for (const group of groups) {
        c.subscribe(group.groupId as GroupId);
      }
    }

    // Also explicitly ensure the active group router parametrically is subscribed
    if (activeGroupId && activeGroupRef.current !== activeGroupId) {
      c.subscribe(activeGroupId);
      activeGroupRef.current = activeGroupId;
    }

    // Bootstrap tree for active group if missing (handles case where
    // treeUpdate WebSocket was broadcast before we subscribed)
    if (activeGroupId && !treekemManager.hasTree(activeGroupId)) {
      joinGroupTree(activeGroupId).catch((err) => {
        console.debug('[WS] tree bootstrap fallback failed, will retry on treeUpdate', err);
      });
    }

    const unsubscribe = client?.onEvent(handleEvent) ?? getClient().onEvent(handleEvent);

    return () => {
      unsubscribe();
    };
  }, [client, getClient, activeGroupId, groups, handleEvent, treekemManager, joinGroupTree]);

  return {
    client: client ?? getClient(),
  };
}
