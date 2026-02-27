'use client';

import { useChatClientStore } from '@/stores/chat-client-store';
import { useTreeKEM } from '@/hooks/useTreeKEM';
import type { GroupId } from '@microchat/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateGroups } from './useGroups';
import { membersQueryKey } from './useMembers';
import { messagesQueryKey } from './useMessages';

export function useJoinGroup() {
  const client = useChatClientStore((state) => state.client);
  const getClient = useChatClientStore((state) => state.getClient);
  const queryClient = useQueryClient();
  const { getIdentityKey, joinGroupTree } = useTreeKEM();

  return useMutation({
    mutationFn: async (groupId: GroupId) => {
      const c = client ?? getClient();
      const keyPair = await getIdentityKey();
      const pubRaw = new Uint8Array(
        await crypto.subtle.exportKey('raw', keyPair.publicKey),
      );
      const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
      const publicKeyB64 = b64(pubRaw);
      return c.joinGroup(groupId, { publicKey: publicKeyB64, credential: publicKeyB64 });
    },
    onSuccess: async (_result, groupId) => {
      // Bootstrap tree immediately — don't rely solely on WebSocket treeUpdate
      // which may arrive before we're subscribed
      try {
        await joinGroupTree(groupId);
      } catch (err) {
        // Tree may not be ready yet (existing member hasn't run addMember).
        // useWebSocket will retry when treeUpdate arrives.
        console.debug('[useJoinGroup] tree bootstrap deferred, will retry on treeUpdate', err);
      }

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
