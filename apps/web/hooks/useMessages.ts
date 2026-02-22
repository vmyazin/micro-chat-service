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
    retry: 1,
    staleTime: 0, // Always fresh, but cached
  });
}
