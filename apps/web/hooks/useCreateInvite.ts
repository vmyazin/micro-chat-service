'use client';

import { useChatClientStore } from '@/stores/chat-client-store';
import { membersQueryKey } from '@/hooks/useMembers';
import type { GroupId, InviteResult } from '@microchat/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useCreateInvite(groupId: GroupId | null | undefined) {
  const client = useChatClientStore((state) => state.client);
  const getClient = useChatClientStore((state) => state.getClient);
  const queryClient = useQueryClient();

  return useMutation<InviteResult, Error, void>({
    mutationFn: async () => {
      if (!groupId) throw new Error('No group ID');
      const c = client ?? getClient();
      return c.createInvite(groupId);
    },
    onSuccess: () => {
      // Creating an invite doesn't invalidate members,
      // but could be used to refresh if needed
      if (groupId) {
        queryClient.invalidateQueries({
          queryKey: membersQueryKey(groupId),
        });
      }
    },
  });
}
