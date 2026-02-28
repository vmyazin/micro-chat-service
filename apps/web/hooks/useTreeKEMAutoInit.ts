'use client';

import { useEffect } from 'react';
import { useChatClientStore } from '@/stores/chat-client-store';
import { useGroups } from '@/hooks/useGroups';
import { useTreeKEM } from '@/hooks/useTreeKEM';

/**
 * Silently re-initializes TreeKEM for all groups on mount.
 * Runs in the background after page reload so encrypted sends
 * can resume without user intervention.
 */
export function useTreeKEMAutoInit() {
  const { data: groups } = useGroups();
  const treekemManager = useChatClientStore((state) => state.treekemManager);
  const { joinGroupTree } = useTreeKEM();

  useEffect(() => {
    if (!groups || groups.length === 0) return;

    for (const group of groups) {
      if (!treekemManager.hasTree(group.groupId)) {
        joinGroupTree(group.groupId, 0).catch((err) => {
          if (process.env.NODE_ENV !== 'production') {
            console.warn(
              `[TreeKEM] Auto-init failed for group ${group.groupId}:`,
              err,
            );
          }
        });
      }
    }
  }, [groups, treekemManager, joinGroupTree]);
}
