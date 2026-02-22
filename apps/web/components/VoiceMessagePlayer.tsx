'use client';

import { base64ToUint8Array } from '@microchat/client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PlayPauseButton } from '@/components/PlayPauseButton';

interface VoiceMessagePlayerProps {
  audioData: string;
  mimeType: string;
  duration: number;
  isOwn: boolean;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function VoiceMessagePlayer({
  audioData,
  mimeType,
  duration,
  isOwn,
}: VoiceMessagePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const bytes = base64ToUint8Array(audioData);
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const audio = new Audio(url);
    audioRef.current = audio;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime * 1000);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.pause();
      audio.src = '';
      URL.revokeObjectURL(url);
    };
  }, [audioData, mimeType]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const progress = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;

  return (
    <div className="flex items-center gap-3 min-w-[200px]">
      <PlayPauseButton isPlaying={isPlaying} isOwn={isOwn} onClick={togglePlay} />

      <div className="flex-1 flex flex-col gap-1.5">
        <div
          className={`h-1.5 rounded-full overflow-hidden ${
            isOwn ? 'bg-white/20' : 'bg-[var(--text-muted)]/20'
          }`}
        >
          <div
            className={`h-full rounded-full transition-[width] duration-100 ${
              isOwn ? 'bg-white/80' : 'bg-[var(--accent)]'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span
          className={`text-[11px] leading-none ${
            isOwn ? 'text-blue-200' : 'text-[var(--text-muted)]'
          }`}
        >
          {isPlaying || currentTime > 0
            ? `${formatDuration(currentTime)} / ${formatDuration(duration)}`
            : formatDuration(duration)}
        </span>
      </div>
    </div>
  );
}
