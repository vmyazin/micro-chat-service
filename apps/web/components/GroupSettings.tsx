'use client';

import { SpinnerGapIcon, XIcon, CopyIcon, CheckIcon, UserPlusIcon, SignOutIcon, TrashIcon, UsersIcon, CrownIcon, QrCodeIcon, ArrowsClockwiseIcon, ShieldCheckIcon } from '@phosphor-icons/react';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { getDirection } from '@/i18n/config';
import { useRouter } from 'next/navigation';
import { useMembers } from '@/hooks/useMembers';
import { useCreateInvite } from '@/hooks/useCreateInvite';
import { useLeaveGroup } from '@/hooks/useLeaveGroup';
import { useDeleteGroup } from '@/hooks/useDeleteGroup';
import type { GroupId } from '@microchat/client';
import { Button } from '@/components/Button';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { usePresenceStore } from '@/stores/presence-store';
import { useChatClientStore } from '@/stores/chat-client-store';
import { useTreeKEM } from '@/hooks/useTreeKEM';
import InviteQRDialog from '@/components/InviteQRDialog';

interface GroupSettingsProps {
  groupId: GroupId;
  open: boolean;
  onClose: () => void;
}

export default function GroupSettings({ groupId, open, onClose }: GroupSettingsProps) {
  const router = useRouter();
  const t = useTranslations('GroupSettings');
  const locale = useLocale();
  const isRtl = getDirection(locale) === 'rtl';

  // Server state with React Query
  const { data: members = [], isLoading: loading, error: membersError } = useMembers(groupId);
  const onlineUsersByGroup = usePresenceStore((state) => state.onlineUsersByGroup);
  const onlineUsers = onlineUsersByGroup[groupId];

  // Mutations
  const createInvite = useCreateInvite(groupId);
  const leaveGroup = useLeaveGroup();
  const deleteGroup = useDeleteGroup();

  const getClient = useChatClientStore((state) => state.getClient);
  const treekemManager = useChatClientStore((state) => state.treekemManager);
  const { initGroupTree } = useTreeKEM();
  const treeInitialized = treekemManager.hasTree(groupId);

  // Local UI state
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [rotateStatus, setRotateStatus] = useState<'idle' | 'pending' | 'done'>('idle');
  const [showRotateHelp, setShowRotateHelp] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setInviteLink(null);
      setCopied(false);
      setShowLeaveConfirm(false);
      setShowDeleteConfirm(false);
      setLocalError(null);
    }
  }, [open]);

  // Check if any mutation is pending
  const actionLoading = createInvite.isPending || leaveGroup.isPending || deleteGroup.isPending || rotateStatus === 'pending';

  // Combine errors
  const error = localError || membersError?.message || createInvite.error?.message ||
                leaveGroup.error?.message || deleteGroup.error?.message || null;

  // Check if current user is the group owner
  const { data: currentUser } = useCurrentUser();
  const isOwner = members.some((m) => m.isOwner && m.userId === currentUser?.userId);
  const isSelfOnline = (userId: string) => userId === currentUser?.userId;
  const onlineCount = members.filter((m) => isSelfOnline(m.userId) || onlineUsers?.has(m.userId)).length;

  async function handleInvite() {
    setLocalError(null);
    setCopied(false);

    try {
      const result = await createInvite.mutateAsync();
      const link = `${window.location.origin}/invite/${result.code}`;
      setInviteLink(link);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : t('failedCreateInvite'));
    }
  }

  async function handleCopyLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
    } catch {
      const input = document.querySelector<HTMLInputElement>('#invite-link-input');
      if (input) {
        input.select();
        input.setSelectionRange(0, 99999);
      }
    }
  }

  async function handleLeave() {
    setLocalError(null);

    try {
      await leaveGroup.mutateAsync(groupId);
      onClose();
      router.push('/chat');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : t('failedLeaveGroup'));
    }
  }

  async function handleRotateKeys() {
    setLocalError(null);
    setRotateStatus('pending');
    try {
      if (!treekemManager.hasTree(groupId)) {
        // Tree not yet initialized — set it up first (owner initializes epoch 1)
        await initGroupTree(groupId);
      } else {
        // Tree exists — perform a PCS key rotation
        const update = await treekemManager.update(groupId);
        const client = getClient();
        await client.postTreeUpdate(groupId, update);
      }
      setRotateStatus('done');
      setTimeout(() => setRotateStatus('idle'), 2000);
    } catch (err) {
      setRotateStatus('idle');
      setLocalError(err instanceof Error ? err.message : t('rotateKeysFailed'));
    }
  }

  async function handleDelete() {
    setLocalError(null);

    try {
      await deleteGroup.mutateAsync(groupId);
      onClose();
      router.push('/chat');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : t('failedDeleteGroup'));
    }
  }

  return (
    <>
      <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen && !actionLoading) onClose(); }}>
        <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            {/* Backdrop */}
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </Dialog.Overlay>

            {/* Drawer panel */}
            <Dialog.Content
              asChild
              onInteractOutside={(e) => { if (actionLoading) e.preventDefault(); }}
              onEscapeKeyDown={(e) => { if (actionLoading) e.preventDefault(); }}
            >
              <motion.aside
                className={`fixed inset-y-0 z-50 w-full max-w-sm flex flex-col bg-(--background) border-(--border-color) focus:outline-none ${
                  isRtl
                    ? 'left-0 border-r shadow-[8px_0_30px_rgba(0,0,0,0.12)]'
                    : 'right-0 border-l shadow-[-8px_0_30px_rgba(0,0,0,0.12)]'
                }`}
                initial={{ x: isRtl ? '-100%' : '100%' }}
                animate={{ x: 0 }}
                exit={{ x: isRtl ? '-100%' : '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              >
                {/* Header */}
                <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-(--border-color)">
                  <Dialog.Title className="text-lg font-semibold text-(--text-primary)">
                    {t('title')}
                  </Dialog.Title>
                  <Dialog.Description className="sr-only">
                    Manage your group members and configurations.
                  </Dialog.Description>
                  <Button
                    variant="ghost"
                    onClick={onClose}
                    disabled={actionLoading}
                    className="p-1.5 rounded-full hover:bg-(--surface-muted) transition-colors"
                  >
                    <XIcon className="w-5 h-5 text-(--text-secondary)" />
                  </Button>
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto">
                  {/* Error banner */}
                  {error && (
                    <div className="mx-4 mt-4 px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400 text-sm">
                      {error}
                    </div>
                  )}

                  {/* Members section */}
                  <div className="px-5 pt-5 pb-2">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <UsersIcon className="w-4 h-4 text-(--text-muted)" />
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-(--text-muted)">
                          {t('members')}
                        </h3>
                      </div>
                      <span className="text-xs text-(--text-muted) tabular-nums">
                        {onlineCount}/{members.length}
                      </span>
                    </div>

                    {loading ? (
                      <div className="flex justify-center py-8">
                        <LoadingSpinner />
                      </div>
                    ) : (
                      <ul className="space-y-1">
                        {members.map((member) => {
                          const isOnline = isSelfOnline(member.userId) || onlineUsers?.has(member.userId);
                          return (
                            <li
                              key={member.userId}
                              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-(--surface-muted) transition-colors"
                            >
                              {/* Avatar */}
                              <div className="relative shrink-0">
                                <div
                                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white select-none"
                                  style={{ background: avatarColor(member.displayName) }}
                                >
                                  {member.displayName.charAt(0).toUpperCase()}
                                </div>
                                <span
                                  className={`absolute -bottom-0.5 -right-0.5 block w-2.5 h-2.5 rounded-full ring-2 ring-(--background) ${isOnline ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                                  aria-hidden="true"
                                />
                              </div>

                              {/* Name + status */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-(--text-primary) truncate">
                                    {member.displayName}
                                  </span>
                                  {member.isOwner && (
                                    <CrownIcon weight="fill" className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                  )}
                                </div>
                                <span className={`text-xs ${isOnline ? 'text-green-600 dark:text-green-400' : 'text-(--text-muted)'}`}>
                                  {isOnline ? t('online') : t('offline')}
                                </span>
                              </div>
                              <span className="sr-only">
                                {isOnline ? t('online') : t('offline')}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {/* Invite button */}
                    <button
                      type="button"
                      onClick={handleInvite}
                      disabled={actionLoading}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-(--accent) hover:bg-(--accent)/8 transition-colors disabled:opacity-50"
                    >
                      {createInvite.isPending ? (
                        <LoadingSpinner />
                      ) : (
                        <UserPlusIcon className="w-4.5 h-4.5" />
                      )}
                      {t('inviteMember')}
                    </button>

                    {/* Invite link result */}
                    <AnimatePresence>
                      {inviteLink && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="p-3 rounded-lg bg-(--surface-muted) border border-(--border-color) space-y-2">
                            <div className="flex gap-2">
                              <input
                                id="invite-link-input"
                                type="text"
                                readOnly
                                value={inviteLink}
                                className="flex-1 px-2.5 py-1.5 text-xs bg-(--surface-elevated) border border-(--border-color) rounded-md font-mono truncate text-(--text-primary)"
                                onClick={(e) => (e.target as HTMLInputElement).select()}
                              />
                              <Button
                                variant="primary"
                                onClick={handleCopyLink}
                                className="shrink-0 px-2.5 py-1.5 text-xs flex items-center gap-1.5"
                              >
                                {copied ? (
                                  <>
                                    <CheckIcon className="w-3.5 h-3.5" />
                                    {t('copied')}
                                  </>
                                ) : (
                                  <>
                                    <CopyIcon className="w-3.5 h-3.5" />
                                    {t('copy')}
                                  </>
                                )}
                              </Button>
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowQRDialog(true)}
                              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-(--accent) text-white hover:bg-(--accent)/90 transition-colors"
                            >
                              <QrCodeIcon className="w-3.5 h-3.5" />
                              {t('showQRCode')}
                            </button>
                            {copied && (
                              <p className="text-xs text-green-600 dark:text-green-400">
                                {t('linkCopied')}
                              </p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Divider */}
                  <div className="mx-5 my-2 border-t border-(--border-color)" />

                  {/* Security section */}
                  <div className="px-5 py-3 space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <ShieldCheckIcon className="w-4 h-4 text-(--text-muted)" />
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-(--text-muted)">
                        {t('security')}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={handleRotateKeys}
                        disabled={actionLoading}
                        className="flex-1 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-(--text-primary) hover:bg-(--surface-muted) transition-colors disabled:opacity-50"
                      >
                        {rotateStatus === 'pending' ? (
                          <LoadingSpinner />
                        ) : rotateStatus === 'done' ? (
                          <CheckIcon className="w-4.5 h-4.5 text-green-500" />
                        ) : (
                          <ArrowsClockwiseIcon className="w-4.5 h-4.5" />
                        )}
                        <span className={rotateStatus === 'done' ? 'text-green-600 dark:text-green-400' : ''}>
                          {rotateStatus === 'done'
                            ? t('rotateKeysDone')
                            : treeInitialized
                              ? t('rotateKeys')
                              : t('initializeEncryption')}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowRotateHelp((v) => !v)}
                        className={`shrink-0 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                          showRotateHelp
                            ? 'bg-(--accent) text-white'
                            : 'text-(--text-muted) hover:text-(--accent)'
                        }`}
                      >
                        {t('rotateKeysHelpToggle')}
                      </button>
                    </div>
                    <AnimatePresence>
                      {showRotateHelp && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.18 }}
                          className="overflow-hidden px-3 text-xs text-(--text-muted) leading-relaxed"
                        >
                          {treeInitialized ? t('rotateKeysDescription') : t('initializeEncryptionDescription')}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                </div>

                {/* Footer — danger zone actions pinned to bottom */}
                <div className="shrink-0 border-t border-(--border-color) px-5 py-4 space-y-2 bg-(--surface-muted)/50">
                  {!showLeaveConfirm ? (
                    <button
                      type="button"
                      onClick={() => setShowLeaveConfirm(true)}
                      disabled={actionLoading}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors disabled:opacity-50"
                    >
                      <SignOutIcon className="w-4.5 h-4.5" />
                      {t('leaveGroup')}
                    </button>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded-lg bg-orange-50 dark:bg-orange-900/15 border border-orange-200 dark:border-orange-800/40"
                    >
                      <p className="text-sm text-orange-700 dark:text-orange-400 mb-3">
                        {t('leaveConfirm')}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          onClick={() => setShowLeaveConfirm(false)}
                          disabled={actionLoading}
                          className="flex-1 text-sm hover:bg-(--surface-muted)"
                        >
                          {t('cancel')}
                        </Button>
                        <Button
                          variant="warning"
                          onClick={handleLeave}
                          disabled={actionLoading}
                          className="flex-1 text-sm flex items-center justify-center gap-1.5"
                        >
                          {leaveGroup.isPending && <LoadingSpinner />}
                          {t('leave')}
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {isOwner && (
                    <>
                      {!showDeleteConfirm ? (
                        <button
                          type="button"
                          onClick={() => setShowDeleteConfirm(true)}
                          disabled={actionLoading}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                        >
                          <TrashIcon className="w-4.5 h-4.5" />
                          {t('deleteGroup')}
                        </button>
                      ) : (
                        <motion.div
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-3 rounded-lg bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800/40"
                        >
                          <p className="text-sm text-red-700 dark:text-red-400 mb-3">
                            {t('deleteConfirm')}
                          </p>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              onClick={() => setShowDeleteConfirm(false)}
                              disabled={actionLoading}
                              className="flex-1 text-sm hover:bg-(--surface-muted)"
                            >
                              {t('cancel')}
                            </Button>
                            <Button
                              variant="danger"
                              onClick={handleDelete}
                              disabled={actionLoading}
                              className="flex-1 text-sm flex items-center justify-center gap-1.5"
                            >
                              {deleteGroup.isPending && <LoadingSpinner />}
                              {t('delete')}
                            </Button>
                          </div>
                        </motion.div>
                      )}
                    </>
                  )}
                </div>
              </motion.aside>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
      </Dialog.Root>

      <InviteQRDialog
        open={showQRDialog}
        onClose={() => setShowQRDialog(false)}
        inviteLink={inviteLink || ''}
      />
    </>
  );
}

/** Deterministic color from a display name for avatars */
function avatarColor(name: string): string {
  const palette = [
    '#E53E3E', '#DD6B20', '#D69E2E', '#38A169', '#319795',
    '#3182CE', '#805AD5', '#D53F8C', '#00B5D8', '#F6AD55',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

function LoadingSpinner() {
  return (
    <SpinnerGapIcon className="animate-spin h-4 w-4" />
  );
}
