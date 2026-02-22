'use client';

import { useChatClientStore } from '@/stores/chat-client-store';
import type { GroupId, GroupMember } from '@microchat/client';
import { useQuery } from '@tanstack/react-query';

export function membersQueryKey(groupId: GroupId) {
  return ['members', groupId] as const;
}

export function useMembers(groupId: GroupId | null | undefined) {
  const client = useChatClientStore((state) => state.client);
  const getClient = useChatClientStore((state) => state.getClient);

  return useQuery<GroupMember[]>({
    queryKey: groupId ? membersQueryKey(groupId) : ['members', 'none'],
    queryFn: async () => {
      if (!groupId) return [];
      const c = client ?? getClient();
      const result = await c.getMembers(groupId);
      return result.members;
    },
    enabled: !!groupId,
    retry: 1,
    staleTime: 60 * 1000, // 1 minute
  });
}
