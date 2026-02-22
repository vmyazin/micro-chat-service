'use client';

import { Pause, Play } from '@phosphor-icons/react';

interface PlayPauseButtonProps {
  isPlaying: boolean;
  isOwn: boolean;
  onClick: () => void;
}

export function PlayPauseButton({ isPlaying, isOwn, onClick }: PlayPauseButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isPlaying}
      aria-label={isPlaying ? 'Pause voice message' : 'Play voice message'}
      className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 ${
        isOwn
          ? 'bg-white/20 hover:bg-white/30'
          : 'bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20'
      }`}
    >
      {isPlaying ? (
        <Pause
          weight="fill"
          className={`w-6 h-6 ${isOwn ? 'text-white' : 'text-[var(--accent)]'}`}
          aria-hidden="true"
        />
      ) : (
        <Play
          weight="fill"
          className={`w-6 h-6 ${isOwn ? 'text-white' : 'text-[var(--accent)]'}`}
          aria-hidden="true"
        />
      )}
    </button>
  );
}
