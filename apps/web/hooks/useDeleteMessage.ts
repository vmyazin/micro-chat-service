'use client';

import { useChatClientStore } from '@/stores/chat-client-store';
import type { GroupId } from '@microchat/client';
import { useMutation } from '@tanstack/react-query';

export function useDeleteMessage(groupId: GroupId | null | undefined) {
  const client = useChatClientStore((state) => state.client);
  const getClient = useChatClientStore((state) => state.getClient);

  return useMutation<void, Error, string>({
    mutationFn: async (messageId) => {
      if (!groupId) throw new Error('No group ID');
      const c = client ?? getClient();
      return c.deleteMessage(groupId, messageId);
    },
    // onSuccess: Invalidation removed. 
    // The WebSocket handles marking the message as deleted in the cache.
    // This prevents D1 read-replica lag from wiping out local optimistic messages
    // and reduces API calls.
  });
}
