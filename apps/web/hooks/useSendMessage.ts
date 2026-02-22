'use client';

import { useChatClientStore } from '@/stores/chat-client-store';
import type { GroupId, SendMessageOptions, SendMessageResult } from '@microchat/client';
import { useMutation } from '@tanstack/react-query';

interface SendMessageVariables {
  content: string;
  epoch?: number;
  options?: SendMessageOptions;
}

export function useSendMessage(groupId: GroupId | null | undefined) {
  const client = useChatClientStore((state) => state.client);
  const getClient = useChatClientStore((state) => state.getClient);
  
  return useMutation<SendMessageResult, Error, SendMessageVariables>({
    mutationFn: async ({ content, epoch, options }) => {
      if (!groupId) throw new Error('No group ID');
      const c = client ?? getClient();
      return c.sendMessage(groupId, content, epoch, options);
    },
    // onSuccess: Invalidation removed. 
    // The WebSocket handles adding the new message to the cache.
    // This prevents D1 read-replica lag from wiping out local optimistic messages
    // and reduces API calls.
  });
}
