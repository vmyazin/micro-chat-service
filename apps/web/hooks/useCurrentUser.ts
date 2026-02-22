'use client';

import { useChatClientStore } from '@/stores/chat-client-store';
import type { CurrentUser } from '@microchat/client';
import { useQuery } from '@tanstack/react-query';

const QUERY_KEY = ['currentUser'];

export function useCurrentUser() {
  const client = useChatClientStore((state) => state.client);
  const getClient = useChatClientStore((state) => state.getClient);

  return useQuery<CurrentUser>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const c = client ?? getClient();
      return c.getCurrentUser();
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
