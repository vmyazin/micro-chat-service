'use client';

import { PlusIcon, SpinnerGapIcon } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import { useGroups } from '@/hooks/useGroups';
import { Button } from '@/components/Button';
import { SidebarItem } from '@/components/SidebarItem';
import { usePresenceStore } from '@/stores/presence-store';

interface GroupListProps {
  onNewGroup: () => void;
  selectedGroupId?: string;
}

export default function GroupList({ onNewGroup, selectedGroupId }: GroupListProps) {
  const router = useRouter();
  const { data: groups, isLoading, error, refetch } = useGroups();
  const onlineUsersByGroup = usePresenceStore((state) => state.onlineUsersByGroup);

  function handleGroupClick(groupId: string) {
    router.push(`/chat/${groupId}`);
  }

  // Handle auth errors by redirecting
  if (error && (error.message.includes('session') || error.message.includes('Authentication required'))) {
    router.push('/login?redirect=/chat');
    return null;
  }

  return (
    <div className="flex flex-col h-full">
      <Button variant="outline"
        onClick={onNewGroup}
        className="w-full mb-4 flex items-center justify-center ga"
      >
        <PlusIcon className="w-5 h-5" />
        New Group
      </Button>

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner />
        </div>
      )}

      {error && (
        <div className="p-3 border-base bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm mb-4">
          {error.message}
          <Button variant="ghost"
            onClick={() => refetch()}
            className="block mt-2 text-xs underline hover:no-underline"
          >
            Retry
          </Button>
        </div>
      )}

      {!isLoading && !error && (!groups || groups.length === 0) && (
        <p className="text-sm text-(--text-muted) text-center py-4">
          No groups yet. Create one to get started!
        </p>
      )}

      {!isLoading && groups && groups.length > 0 && (
        <ul className="space-y-2 flex-1 overflow-y-auto">
          {groups.map((group) => (
            <li key={group.groupId}>
              <SidebarItem
                onClick={() => handleGroupClick(group.groupId)}
                isActive={selectedGroupId === group.groupId}
                title={decodeGroupName(group.encryptedName)}
                description={group.memberCount < 4 && group.memberNames.length > 0
                  ? group.memberNames.join(', ')
                  : `${group.memberCount} member${group.memberCount !== 1 ? 's' : ''}`}
                isOnline={
                  group.memberCount <= 2 
                    ? (onlineUsersByGroup[group.groupId]?.size ?? 0) > 0
                    : undefined
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function decodeGroupName(encryptedName: string): string {
  return encryptedName;
}

function LoadingSpinner() {
  return (
    <SpinnerGapIcon className="animate-spin h-5 w-5" />
  );
}
