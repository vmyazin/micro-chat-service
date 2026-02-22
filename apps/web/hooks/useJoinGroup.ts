'use client';

import { useChatClientStore } from '@/stores/chat-client-store';
import type { GroupId } from '@microchat/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateGroups } from './useGroups';
import { membersQueryKey } from './useMembers';
import { messagesQueryKey } from './useMessages';

export function useJoinGroup() {
  const client = useChatClientStore((state) => state.client);
  const getClient = useChatClientStore((state) => state.getClient);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (groupId: GroupId) => {
      const c = client ?? getClient();
      await c.joinGroup(groupId);
    },
    onSuccess: (_, groupId) => {
      // Invalidate relevant queries to fetch the newly joined group data
      queryClient.invalidateQueries({
        queryKey: invalidateGroups(),
      });
      queryClient.invalidateQueries({
        queryKey: membersQueryKey(groupId),
      });
      queryClient.invalidateQueries({
        queryKey: messagesQueryKey(groupId),
      });
    },
  });
}
