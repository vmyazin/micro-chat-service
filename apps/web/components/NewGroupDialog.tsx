'use client';

import { SpinnerGapIcon } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateGroup } from '@/hooks/useCreateGroup';
import { useTreeKEM } from '@/hooks/useTreeKEM';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from './Button';

interface NewGroupDialogProps {
  open: boolean;
  onClose: () => void;
  onGroupCreated?: (groupId: string) => void;
}

export default function NewGroupDialog({ open, onClose, onGroupCreated }: NewGroupDialogProps) {
  const router = useRouter();
  const t = useTranslations('NewGroupDialog');
  const [groupName, setGroupName] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isInitializingTree, setIsInitializingTree] = useState(false);

  const createGroup = useCreateGroup();
  const { initGroupTree } = useTreeKEM();

  const isPending = createGroup.isPending || isInitializingTree;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!groupName.trim()) {
      setLocalError(t('enterGroupName'));
      return;
    }

    setLocalError(null);

    try {
      const createPromise = createGroup.mutateAsync(groupName.trim());

      let safariCopied = false;
      try {
        if (typeof window !== 'undefined' && window.ClipboardItem && navigator.clipboard?.write) {
          const item = new ClipboardItem({
            'text/plain': createPromise.then(result => new Blob([`${window.location.origin}/chat/${result.groupId}`], { type: 'text/plain' }))
          });
          navigator.clipboard.write([item]).catch(console.error);
          safariCopied = true;
        }
      } catch (e) {
        // Ignored, fallback below
      }

      const result = await createPromise;

      // Initialize TreeKEM ratchet tree for the new group.
      // Must be awaited so the key is ready before the user lands on the chat page.
      setIsInitializingTree(true);
      try {
        await initGroupTree(result.groupId);
      } catch (err) {
        console.error('[NewGroupDialog] Tree init failed:', err);
        // Non-fatal — user will see an error on first send attempt.
      } finally {
        setIsInitializingTree(false);
      }

      setGroupName('');
      onGroupCreated?.(result.groupId);

      if (!safariCopied) {
        try {
          const inviteLink = `${window.location.origin}/chat/${result.groupId}`;
          await navigator.clipboard.writeText(inviteLink);
        } catch (clipboardError) {
          console.error('Failed to copy to clipboard', clipboardError);
        }
      }

      onClose();
      router.push(`/chat/${result.groupId}`);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : t('failedCreateGroup'));
    }
  }

  function handleClose() {
    if (!isPending) {
      setGroupName('');
      setLocalError(null);
      onClose();
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[95vw] max-w-md card-base bg-[var(--background)] p-6 focus:outline-none">
          <Dialog.Title className="text-xl font-bold mb-4">{t('title')}</Dialog.Title>
          <Dialog.Description className="sr-only">Enter a name for your new group.</Dialog.Description>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label
                htmlFor="groupName"
                className="block text-sm font-medium mb-2"
              >
                {t('groupNameLabel')}
              </label>
              <input
                id="groupName"
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder={t('groupNamePlaceholder')}
                disabled={isPending}
                className="w-full p-3 border-base bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                autoFocus
                data-testid="group-name-input"
              />
            </div>

            {localError && (
              <div className="mb-4 p-3 border-base bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                {localError}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isPending}
              >
                {t('cancel')}
              </Button>
              <Button
                type="submit"
                variant="colorful"
                disabled={isPending || !groupName.trim()}
                data-testid="create-group-submit"
              >
                {isPending && <LoadingSpinner />}
                {t('createAndCopy')}
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
    <SpinnerGapIcon className="animate-spin h-4 w-4" />
  );
}
