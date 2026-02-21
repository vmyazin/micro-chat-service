'use client';

import { useEffect, useState } from 'react';
import type { CallSession } from '@microchat/client';

interface IncomingCallModalProps {
  session: CallSession | null;
  onAccept: () => void;
  onReject: () => void;
}

export function IncomingCallModal({ session, onAccept, onReject }: IncomingCallModalProps) {
  const [elapsed, setElapsed] = useState(0);

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
      if (state === 'ended') {
        onReject();
      }
    });

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
      offState();
    };
  }, [session, onReject]);

  if (!session) return null;

  const callerName =
    session.remoteUserName ?? session.remoteUserId ?? 'Unknown';

  return (
    <div className="call-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <section className="call-modal-dialog bg-[var(--surface-elevated)] brutal-border rounded-2xl p-8 max-w-sm w-full mx-4 text-center">
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
          <button
            type="button"
            onClick={onReject}
            className="call-action-reject flex-1 py-3 px-4 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-semibold hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors flex items-center justify-center gap-2"
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
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="call-action-accept flex-1 py-3 px-4 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
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
          </button>
        </div>
      </section>
    </div>
  );
}
