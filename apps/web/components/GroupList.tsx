'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MicroChatClient, type GroupListItem } from '@microchat/client';

interface GroupListProps {
  onNewGroup: () => void;
  selectedGroupId?: string;
}

export default function GroupList({ onNewGroup, selectedGroupId }: GroupListProps) {
  const router = useRouter();
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGroups();
  }, []);

  async function fetchGroups() {
    try {
      setLoading(true);
      setError(null);
      const client = new MicroChatClient({
        baseUrl: process.env.NEXT_PUBLIC_API_URL || '',
      });
      const result = await client.listGroups();
      setGroups(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  }

  function handleGroupClick(groupId: string) {
    router.push(`/chat/${groupId}`);
  }

  return (
    <div className="flex flex-col h-full">
      <button
        onClick={onNewGroup}
        className="w-full brutal-btn mb-4 flex items-center justify-center gap-2"
      >
        <PlusIcon />
        New Group
      </button>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner />
        </div>
      )}

      {error && (
        <div className="p-3 brutal-border bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm mb-4">
          {error}
          <button
            onClick={fetchGroups}
            className="block mt-2 text-xs underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && groups.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
          No groups yet. Create one to get started!
        </p>
      )}

      {!loading && groups.length > 0 && (
        <ul className="space-y-2 flex-1 overflow-y-auto">
          {groups.map((group) => (
            <li key={group.groupId}>
              <button
                onClick={() => handleGroupClick(group.groupId)}
                className={`w-full text-left p-3 brutal-border transition-colors ${
                  selectedGroupId === group.groupId
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <div className="font-semibold truncate">
                  {decodeGroupName(group.encryptedName)}
                </div>
                <div className="text-xs opacity-70 mt-1">
                  {group.memberCount} member{group.memberCount !== 1 ? 's' : ''}
                </div>
              </button>
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

function PlusIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin h-5 w-5"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
