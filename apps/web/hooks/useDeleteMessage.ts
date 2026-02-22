'use client';

import { useChatClientStore } from '@/stores/chat-client-store';
import { messagesQueryKey } from '@/hooks/useMessages';
import type { GroupId } from '@microchat/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useDeleteMessage(groupId: GroupId | null | undefined) {
  const client = useChatClientStore((state) => state.client);
  const getClient = useChatClientStore((state) => state.getClient);
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (messageId) => {
      if (!groupId) throw new Error('No group ID');
      const c = client ?? getClient();
      return c.deleteMessage(groupId, messageId);
    },
    onSuccess: () => {
      if (groupId) {
        queryClient.invalidateQueries({
          queryKey: messagesQueryKey(groupId),
        });
      }
    },
  });
}
