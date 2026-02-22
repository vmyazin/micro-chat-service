'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MicroChatClient, type GroupId, type GroupMember } from '@microchat/client';
import { Button } from '@/components/Button';
import * as Dialog from '@radix-ui/react-dialog';

interface GroupSettingsProps {
  groupId: GroupId;
  open: boolean;
  onClose: () => void;
}

export default function GroupSettings({ groupId, open, onClose }: GroupSettingsProps) {
  const router = useRouter();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const getClient = useCallback(() => {
    return new MicroChatClient({
      baseUrl: process.env.NEXT_PUBLIC_API_URL || '',
    });
  }, []);

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const client = getClient();
      const result = await client.getMembers(groupId);
      setMembers(result.members);
      setOwnerId(result.ownerId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load members');
    } finally {
      setLoading(false);
    }
  }, [groupId, getClient]);

  useEffect(() => {
    if (open) {
      fetchMembers();
      setInviteLink(null);
      setCopied(false);
      setShowLeaveConfirm(false);
      setShowDeleteConfirm(false);
    }
  }, [open, fetchMembers]);

  if (!open) return null;

  async function handleInvite() {
    try {
      setActionLoading(true);
      setError(null);
      setCopied(false);
      const client = getClient();
      const result = await client.createInvite(groupId);
      const link = `${window.location.origin}/invite/${result.code}`;
      setInviteLink(link);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invite');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCopyLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
    } catch {
      // Fallback: select the text for manual copy
      const input = document.querySelector<HTMLInputElement>('#invite-link-input');
      if (input) {
        input.select();
        input.setSelectionRange(0, 99999);
      }
    }
  }

  async function handleLeave() {
    try {
      setActionLoading(true);
      setError(null);
      const client = getClient();
      await client.leaveGroup(groupId);
      onClose();
      router.push('/chat');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to leave group');
      setActionLoading(false);
    }
  }

  async function handleDelete() {
    try {
      setActionLoading(true);
      setError(null);
      const client = getClient();
      await client.deleteGroup(groupId);
      onClose();
      router.push('/chat');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete group');
      setActionLoading(false);
    }
  }

  const isOwner = members.some((m) => m.isOwner && m.userId === ownerId);

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen && !actionLoading) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content 
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 card-base bg-[var(--background)] p-6 w-[95vw] max-w-md max-h-[80vh] overflow-y-auto focus:outline-none"
          onInteractOutside={(e) => { if (actionLoading) e.preventDefault(); }}
          onEscapeKeyDown={(e) => { if (actionLoading) e.preventDefault(); }}
        >
          <div className="flex justify-between items-center mb-4">
            <Dialog.Title className="text-xl font-bold">Group Settings</Dialog.Title>
            <Dialog.Description className="sr-only">Manage your group members and configurations.</Dialog.Description>
          <Button variant="ghost"
            onClick={onClose}
            disabled={actionLoading}
            className="hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>

        {error && (
          <div className="mb-4 p-3 border-base bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3">Members</h3>
          {loading ? (
            <div className="flex justify-center py-4">
              <LoadingSpinner />
            </div>
          ) : (
            <ul className="space-y-2">
              {members.map((member) => (
                <li
                  key={member.userId}
                  className="flex items-center justify-between p-2 border-base bg-white dark:bg-gray-900"
                >
                  <div>
                    <span className="font-medium">{member.displayName}</span>
                    {member.isOwner && (
                      <span className="ml-2 text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 rounded">
                        Owner
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-3">
          <Button variant="primary"
            onClick={handleInvite}
            disabled={actionLoading}
            className="w-full disabled:opacity-50 flex items-center justify-center ga"
          >
            {actionLoading && !inviteLink && <LoadingSpinner />}
            Invite Member
          </Button>

          {inviteLink && (
            <div className="p-3 border-base bg-gray-50 dark:bg-gray-800 space-y-2">
              <div className="flex gap-2">
                <input
                  id="invite-link-input"
                  type="text"
                  readOnly
                  value={inviteLink}
                  className="flex-1 p-2 text-sm border-base bg-white dark:bg-gray-900 font-mono truncate"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button variant="primary"
                  onClick={handleCopyLink}
                  className="text-sm"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
              {copied && (
                <p className="text-sm text-green-600 dark:text-green-400">
                  Link copied to clipboard!
                </p>
              )}
            </div>
          )}

          <hr className="border-gray-200 dark:border-gray-700" />

          {!showLeaveConfirm ? (
            <Button variant="ghost"
              onClick={() => setShowLeaveConfirm(true)}
              disabled={actionLoading}
              className="w-full p-3 border-base text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 disabled:opacity-50"
            >
              Leave Group
            </Button>
          ) : (
            <div className="p-3 border-base bg-orange-50 dark:bg-orange-900/20">
              <p className="text-sm text-orange-700 dark:text-orange-400 mb-3">
                Are you sure you want to leave this group?
              </p>
              <div className="flex gap-2">
                <Button variant="ghost"
                  onClick={() => setShowLeaveConfirm(false)}
                  disabled={actionLoading}
                  className="flex-1 p-2 border-base hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
                >
                  Cancel
                </Button>
                <Button variant="warning"
                  onClick={handleLeave}
                  disabled={actionLoading}
                  className="flex-1 border-base flex items-center justify-center ga"
                >
                  {actionLoading && <LoadingSpinner />}
                  Leave
                </Button>
              </div>
            </div>
          )}

          {isOwner && (
            <>
              {!showDeleteConfirm ? (
                <Button variant="ghost"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={actionLoading}
                  className="w-full p-3 border-base text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                >
                  Delete Group
                </Button>
              ) : (
                <div className="p-3 border-base bg-red-50 dark:bg-red-900/20">
                  <p className="text-sm text-red-700 dark:text-red-400 mb-3">
                    Are you sure? This will permanently delete the group and all messages.
                  </p>
                  <div className="flex gap-2">
                    <Button variant="ghost"
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={actionLoading}
                      className="flex-1 p-2 border-base hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
                    >
                      Cancel
                    </Button>
                    <Button variant="danger"
                      onClick={handleDelete}
                      disabled={actionLoading}
                      className="flex-1 border-base flex items-center justify-center ga"
                    >
                      {actionLoading && <LoadingSpinner />}
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
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
