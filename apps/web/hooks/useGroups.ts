'use client';

import { useChatClientStore } from '@/stores/chat-client-store';
import type { GroupListItem } from '@microchat/client';
import { useQuery } from '@tanstack/react-query';

const QUERY_KEY = ['groups'];

export function useGroups() {
  const client = useChatClientStore((state) => state.client);
  const getClient = useChatClientStore((state) => state.getClient);

  return useQuery<GroupListItem[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const c = client ?? getClient();
      return c.listGroups();
    },
    retry: 1,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function invalidateGroups() {
  return ['groups'];
}
