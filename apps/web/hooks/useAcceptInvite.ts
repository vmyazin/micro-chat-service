'use client';

import { useChatClientStore } from '@/stores/chat-client-store';
import { invalidateGroups } from '@/hooks/useGroups';
import type { AcceptInviteResult } from '@microchat/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface AcceptInviteVariables {
  code: string;
  keyPackage?: { publicKey: string; credential: string };
}

export function useAcceptInvite() {
  const client = useChatClientStore((state) => state.client);
  const getClient = useChatClientStore((state) => state.getClient);
  const queryClient = useQueryClient();

  return useMutation<AcceptInviteResult, Error, AcceptInviteVariables>({
    mutationFn: async ({ code, keyPackage }) => {
      const c = client ?? getClient();
      return c.acceptInvite(code, keyPackage);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: invalidateGroups(),
      });
    },
  });
}
