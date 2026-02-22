'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MicroChatClient } from '@microchat/client';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from './Button';

interface NewGroupDialogProps {
  open: boolean;
  onClose: () => void;
  onGroupCreated?: (groupId: string) => void;
}

export default function NewGroupDialog({ open, onClose, onGroupCreated }: NewGroupDialogProps) {
  const router = useRouter();
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!groupName.trim()) {
      setError('Please enter a group name');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const client = new MicroChatClient({
        baseUrl: process.env.NEXT_PUBLIC_API_URL || '',
      });

      const result = await client.createGroup(groupName.trim());

      setGroupName('');
      onGroupCreated?.(result.groupId);

      try {
        const inviteLink = `${window.location.origin}/chat/${result.groupId}`;
        await navigator.clipboard.writeText(inviteLink);
      } catch (clipboardError) {
        console.error('Failed to copy to clipboard', clipboardError);
      }

      onClose();
      router.push(`/chat/${result.groupId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    if (!loading) {
      setGroupName('');
      setError(null);
      onClose();
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[95vw] max-w-md card-base bg-[var(--background)] p-6 focus:outline-none">
          <Dialog.Title className="text-xl font-bold mb-4">Create New Group</Dialog.Title>
          <Dialog.Description className="sr-only">Enter a name for your new group.</Dialog.Description>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label
                htmlFor="groupName"
                className="block text-sm font-medium mb-2"
              >
                Group Name
              </label>
              <input
                id="groupName"
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Enter group name..."
                disabled={loading}
                className="w-full p-3 border-base bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                autoFocus
              />
            </div>

            {error && (
              <div className="mb-4 p-3 border-base bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="colorful"
                disabled={loading || !groupName.trim()}
              >
                {loading && <LoadingSpinner />}
                Create & Copy Link
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
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
