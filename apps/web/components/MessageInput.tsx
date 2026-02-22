'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { Image, Mic, Square, X, Smile, Paperclip, Send } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useImagePicker } from '@/hooks/useImagePicker';
import { formatDuration } from '@/components/VoiceMessagePlayer';
import { Button } from '@/components/Button';

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

  function handlePreviewKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sending && !imagePicker.compressing) {
        void handleSendPastedImage();
      }
    }
  }

  if (isRecording) {
    return (
      <div className="p-4 bg-(--background)">
        <div className="flex items-center gap-2 rounded-4xl bg-white w-full shadow-md p-1.5 border border-gray-200 dark:border-gray-800 dark:bg-(--surface-elevated)">
          <Button variant="ghost"
            type="button"
            onClick={recorderControls.cancel}
            className="w-12 h-12 rounded-[1.25rem] hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 flex items-center justify-center p-0"
            aria-label="Cancel recording"
          >
            <X className="w-6 h-6" />
          </Button>

          <div className="flex-1 flex items-center justify-center gap-3 px-4 py-2 bg-red-50 dark:bg-red-900/10 rounded-[1.25rem] mx-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
            <span className="text-sm font-mono tabular-nums font-medium text-red-600 dark:text-red-400">
              {formatDuration(recorderState.duration)}
            </span>
            <span className="text-sm text-red-400 dark:text-red-500/70">
              / 1:00
            </span>
          </div>

          <Button variant="primary"
            type="button"
            onClick={recorderControls.stop}
            className="min-w-[48px] h-[48px] rounded-[1.25rem] flex items-center justify-center bg-[#00A980] hover:bg-[#00906D] text-white transition-colors p-0"
            aria-label="Stop recording and send"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
        {recorderState.error && (
          <p className="mt-2 text-xs text-red-500 text-center">{recorderState.error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 bg-(--background)">
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
            <div
              className="relative card-base bg-(--background) p-6 w-full max-w-lg"
              onKeyDown={handlePreviewKeyDown}
            >
              <div className="flex items-center justify-between mb-4">
                <Dialog.Title className="text-lg font-semibold">
                  Preview image
                </Dialog.Title>
                <Dialog.Close asChild>
                  <Button variant="ghost"
                    type="button"
                    className="border-base hover:bg-(--surface-muted)"
                    aria-label="Close image preview"
                    disabled={sending || imagePicker.compressing}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </Dialog.Close>
              </div>
              {pastedImageUrl && (
                <div className="border-base bg-(--surface-muted) p-2 mb-4">
                  <img
                    src={pastedImageUrl}
                    alt="Image preview"
                    className="w-full max-h-[60vh] object-contain"
                  />
                </div>
              )}
              {imagePicker.error && (
                <div className="mb-4 p-3 border-base bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                  {imagePicker.error}
                </div>
              )}
              <div className="flex justify-end">
                <Button variant="primary"
                  type="button"
                  onClick={handleSendPastedImage}
                  disabled={sending || imagePicker.compressing}
                  className="bg-(--accent) text-white font-semibold disabled:opacity-50 flex items-center ga"
                >
                  {(sending || imagePicker.compressing) ? <SendingSpinner /> : 'Send'}
                </Button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <input {...imagePicker.inputProps} />
      <div className="flex items-center gap-2 rounded-4xl bg-white w-full shadow-md p-1.5 border border-gray-200 dark:border-gray-800 dark:bg-(--surface-elevated)">
        <input
          ref={inputRef}
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Write your message..."
          disabled={isDisabled}
          className="flex-1 px-4 py-2 bg-transparent text-gray-700 dark:text-gray-200 border-none focus:outline-none focus:ring-0 disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-gray-400 font-medium"
        />

        <div className="flex items-center gap-1 px-2 text-gray-300">
          <button type="button" className="p-2 hover:text-gray-500 transition-colors" aria-label="Add emoji">
            <Smile className="w-6 h-6" />
          </button>

          {onSendImage && (
            <button
              type="button"
              onClick={imagePicker.pickImage}
              disabled={isDisabled || imagePicker.compressing}
              className="p-2 hover:text-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Attach image"
            >
              {imagePicker.compressing ? <SendingSpinner /> : <Paperclip className="w-5 h-5" />}
            </button>
          )}
        </div>

        {onSendVoice && !content.trim() ? (
          <Button variant="ghost"
            type="button"
            onClick={() => recorderControls.start()}
            disabled={isDisabled}
            className="w-12 h-12 rounded-[1.25rem] flex items-center justify-center bg-[var(--accent)] text-white hover:opacity-90 font-semibold transition-opacity disabled:opacity-50 disabled:cursor-not-allowed p-0"
            aria-label="Record voice message"
          >
            <Mic className="w-5 h-5" />
          </Button>
        ) : (
          <Button variant="primary"
            onClick={handleSend}
            disabled={isDisabled || !content.trim()}
            className="min-w-[48px] h-[48px] rounded-[1.25rem] flex items-center justify-center bg-[#00A980] hover:bg-[#00906D] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors p-0"
            aria-label="Send message"
          >
            {sending ? <SendingSpinner /> : <Send className="w-5 h-5" />}
          </Button>
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
