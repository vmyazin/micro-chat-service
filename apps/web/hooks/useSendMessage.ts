'use client';

import { useChatClientStore } from '@/stores/chat-client-store';
import { messagesQueryKey } from '@/hooks/useMessages';
import type { GroupId, SendMessageOptions, SendMessageResult } from '@microchat/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface SendMessageVariables {
  content: string;
  epoch?: number;
  options?: SendMessageOptions;
}

export function useSendMessage(groupId: GroupId | null | undefined) {
  const client = useChatClientStore((state) => state.client);
  const getClient = useChatClientStore((state) => state.getClient);
  const queryClient = useQueryClient();

  return useMutation<SendMessageResult, Error, SendMessageVariables>({
    mutationFn: async ({ content, epoch, options }) => {
      if (!groupId) throw new Error('No group ID');
      const c = client ?? getClient();
      return c.sendMessage(groupId, content, epoch, options);
    },
    onSuccess: () => {
      // Invalidate messages to trigger a refetch
      if (groupId) {
        queryClient.invalidateQueries({
          queryKey: messagesQueryKey(groupId),
        });
      }
    },
  });
}
