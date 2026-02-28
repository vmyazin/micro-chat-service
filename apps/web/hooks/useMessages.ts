'use client';

import { useChatClientStore } from '@/stores/chat-client-store';
import type { GroupId, MessageListItem } from '@microchat/client';
import { useQuery } from '@tanstack/react-query';

export function messagesQueryKey(groupId: GroupId) {
  return ['messages', groupId] as const;
}

export function useMessages(groupId: GroupId | null | undefined) {
  const client = useChatClientStore((state) => state.client);
  const getClient = useChatClientStore((state) => state.getClient);

  return useQuery<MessageListItem[]>({
    queryKey: groupId ? messagesQueryKey(groupId) : ['messages', 'none'],
    queryFn: async () => {
      if (!groupId) return [];
      const c = client ?? getClient();
      return c.getMessages(groupId);
    },
    enabled: !!groupId,
    retry: (failureCount, error) => {
      // Retry up to 3 times on 403 to absorb D1 read-replica replication lag
      // after invite-accept. Real auth failures (non-member) also retry but
      // D1 lag resolves within ~2 seconds, so 3 retries at 500/1000/2000ms is safe.
      if (failureCount < 3 && error instanceof Error && error.message.includes('403')) {
        return true;
      }
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(500 * 2 ** attemptIndex, 3000),
    staleTime: 0, // Always fresh, but cached
  });
}
