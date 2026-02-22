'use client';

import { useChatClientStore } from '@/stores/chat-client-store';
import { invalidateGroups } from '@/hooks/useGroups';
import type { GroupId } from '@microchat/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useDeleteGroup() {
  const client = useChatClientStore((state) => state.client);
  const getClient = useChatClientStore((state) => state.getClient);
  const queryClient = useQueryClient();

  return useMutation<void, Error, GroupId>({
    mutationFn: async (groupId) => {
      const c = client ?? getClient();
      return c.deleteGroup(groupId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: invalidateGroups(),
      });
    },
  });
}
