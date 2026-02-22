'use client';

import { useChatClientStore } from '@/stores/chat-client-store';
import { invalidateGroups } from '@/hooks/useGroups';
import type { CreateGroupResult } from '@microchat/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useCreateGroup() {
  const client = useChatClientStore((state) => state.client);
  const getClient = useChatClientStore((state) => state.getClient);
  const queryClient = useQueryClient();

  return useMutation<CreateGroupResult, Error, string>({
    mutationFn: async (encryptedName) => {
      const c = client ?? getClient();
      return c.createGroup(encryptedName);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: invalidateGroups(),
      });
    },
  });
}
