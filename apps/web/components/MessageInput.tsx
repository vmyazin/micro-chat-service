'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { Image, Mic, Square, X } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useImagePicker } from '@/hooks/useImagePicker';
import { formatDuration } from '@/components/VoiceMessagePlayer';

export interface MessageInputProps {
  onSend: (content: string) => Promise<void>;
  onSendVoice?: (blob: Blob, duration: number) => Promise<void>;
  onSendImage?: (blob: Blob, width: number, height: number) => Promise<void>;
  disabled?: boolean;
}

export function MessageInput({
  onSend,
  onSendVoice,
  onSendImage,
  disabled = false,
}: MessageInputProps) {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [pastedImageFile, setPastedImageFile] = useState<File | null>(null);
  const [pastedImageUrl, setPastedImageUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [recorderState, recorderControls] = useAudioRecorder();

  const imagePicker = useImagePicker({
    onReady: async (blob, width, height) => {
      if (!onSendImage) return;
      try {
        setSending(true);
        await onSendImage(blob, width, height);
      } finally {
        setSending(false);
      }
    },
  });

  const isRecording = recorderState.status === 'recording';

  useEffect(() => {
    if (!sending && !disabled && !isRecording) {
      inputRef.current?.focus();
    }
  }, [sending, disabled, isRecording]);

  useEffect(() => {
    return () => {
      if (pastedImageUrl) {
        URL.revokeObjectURL(pastedImageUrl);
      }
    };
  }, [pastedImageUrl]);

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

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    if (!onSendImage || isDisabled) return;
    const file = extractClipboardImage(e.clipboardData);
    if (!file) return;

    e.preventDefault();
    e.stopPropagation();
    openImagePreview(file);
  }

  const isDisabled = sending || disabled;

  function openImagePreview(file: File) {
    setPastedImageFile(file);
    setPastedImageUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return URL.createObjectURL(file);
    });
    imagePicker.clearError();
  }

  function closeImagePreview() {
    setPastedImageFile(null);
    setPastedImageUrl(null);
    imagePicker.clearError();
  }

  async function handleSendPastedImage() {
    if (!pastedImageFile || !onSendImage) return;
    const success = await imagePicker.processFile(pastedImageFile);
    if (success) {
      closeImagePreview();
    }
  }

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
      <Dialog.Root
        open={Boolean(pastedImageFile && pastedImageUrl)}
        onOpenChange={(open) => {
          if (!open) {
            closeImagePreview();
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <Dialog.Content className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="relative brutal-card bg-[var(--background)] p-6 w-full max-w-lg">
              <div className="flex items-center justify-between mb-4">
                <Dialog.Title className="text-lg font-semibold">
                  Preview image
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="p-2 brutal-border hover:bg-[var(--surface-muted)]"
                    aria-label="Close image preview"
                    disabled={sending || imagePicker.compressing}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </Dialog.Close>
              </div>
              {pastedImageUrl && (
                <div className="brutal-border bg-[var(--surface-muted)] p-2 mb-4">
                  <img
                    src={pastedImageUrl}
                    alt="Image preview"
                    className="w-full max-h-[60vh] object-contain"
                  />
                </div>
              )}
              {imagePicker.error && (
                <div className="mb-4 p-3 brutal-border bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                  {imagePicker.error}
                </div>
              )}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSendPastedImage}
                  disabled={sending || imagePicker.compressing}
                  className="px-4 py-2 brutal-btn bg-[var(--accent)] text-white font-semibold disabled:opacity-50 flex items-center gap-2"
                >
                  {(sending || imagePicker.compressing) ? <SendingSpinner /> : 'Send'}
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <input {...imagePicker.inputProps} />
      <div className="flex gap-2">
        {onSendImage && (
          <button
            type="button"
            onClick={imagePicker.pickImage}
            disabled={isDisabled || imagePicker.compressing}
            className="px-3 py-2 brutal-btn bg-[var(--surface-muted)] hover:bg-[var(--accent)] hover:text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Send image"
          >
            {imagePicker.compressing ? <SendingSpinner /> : <Image className="w-5 h-5" />}
          </button>
        )}
        <input
          ref={inputRef}
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
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
      {(recorderState.error || imagePicker.error) && (
        <p className="mt-2 text-xs text-red-500">{recorderState.error || imagePicker.error}</p>
      )}
    </div>
  );
}

function extractClipboardImage(clipboard: DataTransfer | null): File | null {
  if (!clipboard) return null;

  let file: File | null = null;
  const items = Array.from(clipboard.items || []);
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      file = item.getAsFile();
      if (file) break;
    }
  }

  if (!file && clipboard.files?.length) {
    const candidate = clipboard.files[0];
    if (candidate && candidate.type.startsWith('image/')) {
      file = candidate;
    }
  }

  return file;
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
