'use client';

import { useCallback, useEffect, useRef } from 'react';

const SFX = {
  message: '/sfx/sound-subtle-bleep.mp3',
  memberJoined: '/sfx/sound-pong.mp3',
} as const;

type SfxName = keyof typeof SFX;

export function useSfx() {
  const cacheRef = useRef<Map<SfxName, HTMLAudioElement>>(new Map());

  const play = useCallback((name: SfxName) => {
    let audio = cacheRef.current.get(name);
    if (!audio) {
      audio = new Audio(SFX[name]);
      cacheRef.current.set(name, audio);
    }
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }, []);

  useEffect(() => {
    const cache = cacheRef.current;
    return () => {
      for (const audio of cache.values()) {
        audio.pause();
        audio.src = '';
      }
      cache.clear();
    };
  }, []);

  return play;
}
