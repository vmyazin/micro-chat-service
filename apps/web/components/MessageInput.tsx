'use client';

import { Mic, Square, X } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { formatDuration } from '@/components/VoiceMessagePlayer';

export interface MessageInputProps {
  onSend: (content: string) => Promise<void>;
  onSendVoice?: (blob: Blob, duration: number) => Promise<void>;
  disabled?: boolean;
}

export function MessageInput({
  onSend,
  onSendVoice,
  disabled = false,
}: MessageInputProps) {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [recorderState, recorderControls] = useAudioRecorder();

  const isRecording = recorderState.status === 'recording';

  useEffect(() => {
    if (!sending && !disabled && !isRecording) {
      inputRef.current?.focus();
    }
  }, [sending, disabled, isRecording]);

  // When recording finishes (status becomes 'recorded'), send the audio
  const { status, audioBlob, duration } = recorderState;
  useEffect(() => {
    if (status !== 'recorded' || !audioBlob || !onSendVoice) return;

    const blob = audioBlob;
    const dur = duration;
    recorderControls.cancel();

    (async () => {
      try {
        setSending(true);
        await onSendVoice(blob, dur);
      } finally {
        setSending(false);
      }
    })();
  }, [status, audioBlob, duration, onSendVoice, recorderControls]);

  async function handleSend() {
    const trimmed = content.trim();
    if (!trimmed || sending || disabled) return;

    try {
      setSending(true);
      await onSend(trimmed);
      setContent('');
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const isDisabled = sending || disabled;

  if (isRecording) {
    return (
      <div className="p-4 border-t-[var(--border-thick)] border-[var(--border-color)] bg-[var(--surface-elevated)]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={recorderControls.cancel}
            className="p-2 brutal-border hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
            aria-label="Cancel recording"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex-1 flex items-center gap-3 px-4 py-2 brutal-border bg-[var(--surface-muted)]">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
            <span className="text-sm font-mono tabular-nums">
              {formatDuration(recorderState.duration)}
            </span>
            <span className="text-sm text-[var(--text-muted)]">
              / 1:00
            </span>
          </div>

          <button
            type="button"
            onClick={recorderControls.stop}
            className="px-4 py-2 brutal-btn bg-[var(--accent)] text-white font-semibold flex items-center gap-2"
            aria-label="Stop recording and send"
          >
            <Square className="w-4 h-4" />
            Send
          </button>
        </div>
        {recorderState.error && (
          <p className="mt-2 text-xs text-red-500">{recorderState.error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 border-t-[var(--border-thick)] border-[var(--border-color)] bg-[var(--surface-elevated)]">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={isDisabled}
          className="flex-1 px-4 py-2 brutal-border bg-[var(--surface-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {onSendVoice && !content.trim() ? (
          <button
            type="button"
            onClick={() => recorderControls.start()}
            disabled={isDisabled}
            className="px-4 py-2 brutal-btn bg-[var(--surface-muted)] hover:bg-[var(--accent)] hover:text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Record voice message"
          >
            <Mic className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={isDisabled || !content.trim()}
            className="px-6 py-2 brutal-btn bg-[var(--accent)] text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? <SendingSpinner /> : 'Send'}
          </button>
        )}
      </div>
      {recorderState.error && (
        <p className="mt-2 text-xs text-red-500">{recorderState.error}</p>
      )}
    </div>
  );
}

function SendingSpinner() {
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
