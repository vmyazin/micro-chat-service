'use client';

import { useEffect, useRef, useState } from 'react';
import type { CallSession } from '@microchat/client';
import { Button } from '@/components/Button';
import * as Dialog from '@radix-ui/react-dialog';

interface IncomingCallModalProps {
  session: CallSession | null;
  onAccept: () => void;
  onReject: () => void;
}

export function IncomingCallModal({ session, onAccept, onReject }: IncomingCallModalProps) {
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

  if (!session) return null;

  const callerName =
    session.remoteUserName ?? session.remoteUserId ?? 'Unknown';

  return (
    <Dialog.Root open={!!session}>
      <Dialog.Portal>
        <Dialog.Overlay className="call-modal-overlay fixed inset-0 z-50 bg-black/70" />
        <Dialog.Content 
          className="call-modal-dialog fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-[var(--surface-elevated)] border-base rounded-2xl p-8 max-w-sm w-[95vw] text-center focus:outline-none"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <Dialog.Title className="sr-only">Incoming Call</Dialog.Title>
          <Dialog.Description className="sr-only">You are receiving an incoming call from {callerName}.</Dialog.Description>
          
          <header className="call-modal-header mb-6">
            <div className="call-avatar-container w-20 h-20 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <svg
              className="call-avatar-icon w-10 h-10 text-green-600 dark:text-green-400 animate-pulse"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              />
            </svg>
          </div>
          <h2 className="call-caller-name text-xl font-bold mb-1">{callerName}</h2>
          <p className="call-status-text text-[var(--text-muted)]">Incoming call...</p>
          <p className="call-elapsed-time text-sm text-[var(--text-muted)] mt-2">{elapsed}s</p>
        </header>

        <div className="call-actions flex gap-4">
          <Button variant="ghost"
            type="button"
            onClick={onReject}
            className="call-action-reject flex-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-semibold hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors flex items-center justify-center ga"
          >
            <svg className="call-action-icon w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.516l2.257-1.13a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z"
              />
            </svg>
            Decline
          </Button>
          <Button variant="ghost"
            type="button"
            onClick={() => {
              if (acceptedRef.current) return;
              acceptedRef.current = true;
              onAccept();
            }}
            className="call-action-accept flex-1 bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors flex items-center justify-center ga"
          >
            <svg className="call-action-icon w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              />
            </svg>
            Accept
          </Button>
        </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
