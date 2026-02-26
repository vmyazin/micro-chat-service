'use client';

import { PhoneIcon, PhoneXIcon } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import type { CallSession } from '@microchat/client';
import { Button } from '@/components/Button';

interface IncomingCallModalProps {
  session: CallSession | null;
  onAccept: () => void;
  onReject: () => void;
}

export function IncomingCallModal({ session, onAccept, onReject }: IncomingCallModalProps) {
  const t = useTranslations('IncomingCall');
  const [elapsed, setElapsed] = useState(0);
  // Guards against accept() being invoked more than once (e.g. double-click or
  // effect re-run before session is nulled out by the parent).
  const acceptedRef = useRef(false);

  // Reset the guard whenever a new session arrives.
  useEffect(() => {
    if (session) {
      acceptedRef.current = false;
    }
  }, [session]);

  useEffect(() => {
    if (!session) {
      setElapsed(0);
      return;
    }

    if (session.state === 'ended') {
      onReject();
      return;
    }

    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);

    // Auto-reject after 30 seconds
    const timeout = setTimeout(() => {
      onReject();
    }, 30000);

    const offState = session.onStateChange((state) => {
      // Only call onReject for a true remote hang-up / timeout.
      // Do NOT call it when state becomes 'active' or 'connecting' — those
      // happen on a successful accept and the parent handles them via its own
      // onStateChange listener registered in the call-setup effect.
      if (state === 'ended' && !acceptedRef.current) {
        onReject();
      }
    });

    const ringtone = new Audio('/sfx/call-ring.mp3');
    let ringTimeout: ReturnType<typeof setTimeout>;

    const playRingtone = () => {
      ringtone.play().catch(console.warn);
    };

    ringtone.addEventListener('ended', () => {
      ringTimeout = setTimeout(playRingtone, 1000);
    });

    playRingtone();

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
      clearTimeout(ringTimeout);
      offState();
      ringtone.pause();
      ringtone.src = '';
    };
  }, [session, onReject]);

  const callerName = session?.remoteUserName ?? session?.remoteUserId ?? t('unknown');

  return (
    <AnimatePresence>
      {session && (
        <div
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-label={`${t('incomingCall')} — ${callerName}`}
        >
          {/* Overlay */}
          <motion.div
            className="absolute inset-0 bg-black/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />

          {/* Modal card — springs in from top, morphs into active call header via layoutId */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <motion.div
              layoutId="call-ui"
              className="pointer-events-auto bg-[var(--surface-elevated)] border-base rounded-2xl p-8 max-w-sm w-[95vw] text-center focus:outline-none"
              initial={{ y: '-100vh' }}
              animate={{ y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{
                type: 'spring',
                stiffness: 260,
                damping: 25,
              }}
            >
              <header className="call-modal-header mb-6">
                <div className="call-avatar-container w-20 h-20 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <PhoneIcon className="call-avatar-icon w-10 h-10 text-green-600 dark:text-green-400 animate-pulse" />
                </div>
                <h2 className="call-caller-name text-xl font-bold mb-1">
                  {callerName}
                </h2>
                <p className="call-status-text text-[var(--text-muted)]">
                  {t('incomingCall')}
                </p>
                <p className="call-elapsed-time text-sm text-[var(--text-muted)] mt-2">
                  {elapsed}s
                </p>
              </header>

              <div className="call-actions flex gap-4">
                <Button variant="ghost"
                  type="button"
                  onClick={() => {
                    new Audio('/sfx/hungup.mp3').play().catch(console.warn);
                    onReject();
                  }}
                  className="call-action-reject flex-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-semibold hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors flex items-center justify-center ga"
                >
                  <PhoneXIcon className="call-action-icon w-5 h-5" />
                  {t('decline')}
                </Button>
                {/* Pulsing glow behind the Accept button */}
                <motion.div
                  className="flex-1 rounded-lg"
                  animate={{
                    boxShadow: [
                      '0 0 0 0 rgba(22, 163, 74, 0)',
                      '0 0 20px 8px rgba(22, 163, 74, 0.35)',
                      '0 0 0 0 rgba(22, 163, 74, 0)',
                    ],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: 'easeInOut',
                  }}
                >
                  <Button variant="ghost"
                    type="button"
                    onClick={() => {
                      if (acceptedRef.current) return;
                      acceptedRef.current = true;
                      console.log('[call] Accept button clicked');
                      onAccept();
                    }}
                    className="call-action-accept w-full bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors flex items-center justify-center ga"
                  >
                    <PhoneIcon className="call-action-icon w-5 h-5" />
                    {t('accept')}
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
