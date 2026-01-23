'use client';

import { useState, useRef, useEffect } from 'react';

export interface MessageInputProps {
  onSend: (content: string) => Promise<void>;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled = false }: MessageInputProps) {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!sending && !disabled) {
      inputRef.current?.focus();
    }
  }, [sending, disabled]);

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

  return (
    <div className="p-4 border-t-2 border-black dark:border-gray-700 bg-white dark:bg-gray-900">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={isDisabled}
          className="flex-1 px-4 py-2 brutal-border bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          onClick={handleSend}
          disabled={isDisabled || !content.trim()}
          className="px-6 py-2 brutal-btn bg-black dark:bg-white text-white dark:text-black font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending ? (
            <SendingSpinner />
          ) : (
            'Send'
          )}
        </button>
      </div>
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
