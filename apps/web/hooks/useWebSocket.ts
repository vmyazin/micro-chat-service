'use client';

import { messagesQueryKey } from '@/hooks/useMessages';
import { membersQueryKey } from '@/hooks/useMembers';
import { invalidateGroups } from '@/hooks/useGroups';
import { useChatClientStore } from '@/stores/chat-client-store';
import { useChatStore } from '@/stores/chat-store';
import { usePresenceStore } from '@/stores/presence-store';
import type { GroupId, MessageListItem, WebSocketEvent } from '@microchat/client';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useCallback } from 'react';
import { useGroups } from '@/hooks/useGroups';

export function useWebSocket(activeGroupId?: GroupId | null) {
  const client = useChatClientStore((state) => state.client);
  const getClient = useChatClientStore((state) => state.getClient);
  const queryClient = useQueryClient();
  const { data: groups } = useGroups();

  const setConnectionStatus = useChatStore((state) => state.setConnectionStatus);

  // Track the primary active group
  const activeGroupRef = useRef<GroupId | null>(null);

  // Memoize the event handler with stable dependencies
  const handleEvent = useCallback((event: WebSocketEvent) => {
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
        // Add new message to the cache immediately
        const newMessage: MessageListItem = {
          id: event.messageId,
          groupId: event.groupId,
          senderId: event.senderId,
          senderName: event.senderName,
          encryptedContent: event.encryptedContent,
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
        
        // Wait, the auth client has `getCurrentUser() : Promise<CurrentUser>`.
        // Better to send it asynchronously.
        getClient()
          .getCurrentUser()
          .then((user) => {
             if (user && user.userId !== event.senderId) {
               getClient().sendDeliveryReceipt(event.groupId, event.messageId, user.userId);
             }
          })
          .catch(() => {}); // ignore errors if unauthenticated

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

    const unsubscribe = client?.onEvent(handleEvent) ?? getClient().onEvent(handleEvent);

    return () => {
      unsubscribe();
    };
  }, [client, getClient, activeGroupId, groups, handleEvent]);

  return {
    client: client ?? getClient(),
  };
}
