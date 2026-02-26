'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { CallButton } from '@/components/CallButton';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useCallStore } from '@/stores/call-store';
import { useChatClientStore } from '@/stores/chat-client-store';

/**
 * Persistent call status bar rendered at the layout level.
 * Visible across all routes while a call is dialing or connected.
 */
export function ActiveCallBar() {
  const t = useTranslations('GroupChat');

  const callState = useCallStore((s) => s.callState);
  const activeSession = useCallStore((s) => s.activeSession);
  const targetUserName = useCallStore((s) => s.targetUserName);
  const targetUserId = useCallStore((s) => s.targetUserId);
  const memberCount = useCallStore((s) => s.memberCount);
  const isCalling = useCallStore((s) => s.isCalling);
  const callGroupId = useCallStore((s) => s.callGroupId);

  const { getClient } = useChatClientStore();
  const client = getClient();
  const { data: currentUser } = useCurrentUser();

  const isActive = callState === 'in-call' || callState === 'calling';

  return (
    <AnimatePresence>
      {isActive && callGroupId && (
        <motion.div
          key="active-call-bar"
          layoutId="call-ui"
          className="shrink-0 z-20 w-full flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-emerald-200/70 dark:border-emerald-800/60 bg-emerald-50/80 dark:bg-emerald-950/40 shadow-[0_1px_0_rgba(16,185,129,0.12),0_8px_24px_rgba(0,0,0,0.18)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{
            opacity: 0,
            scaleY: 0,
            y: -20,
          }}
          transition={{
            layout: { type: 'spring', stiffness: 300, damping: 30 },
            exit: { duration: 0.35, ease: [0.4, 0, 0.2, 1] },
          }}
          style={{ originY: 0, borderRadius: 0, overflow: 'hidden' }}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-3 min-w-0">
            {callState === 'in-call' ? (
              <span
                className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.18)] animate-pulse"
                aria-hidden="true"
              />
            ) : (
              <span
                className="inline-flex h-3 w-3 rounded-full border-2 border-emerald-500/70 border-t-transparent animate-spin"
                aria-hidden="true"
              />
            )}
            <div className="min-w-0">
              <p className="text-lg font-semibold text-emerald-950 dark:text-emerald-100 truncate">
                {callState === 'in-call' ? t('liveCall') : t('connectingCall')}
                {targetUserName ? ` ${t('with')} ${targetUserName}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <CallButton
              client={client}
              groupId={callGroupId}
              currentUserId={currentUser?.userId}
              memberCount={memberCount}
              targetUserId={targetUserId}
              calling={isCalling}
              activeSession={activeSession}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
