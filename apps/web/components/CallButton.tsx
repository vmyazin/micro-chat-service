'use client';

import { MicrophoneIcon, MicrophoneSlashIcon, PhoneIcon, PhoneXIcon } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import type { CallSession, CallState, GroupId, MicroChatClient, UserId } from '@microchat/client';
import { Button } from './Button';

interface CallButtonProps {
  client: MicroChatClient;
  groupId: GroupId;
  currentUserId?: UserId | null;
  onStartCall?: () => void;
  memberCount?: number | null;
  targetUserId?: UserId | null;
  calling?: boolean;
  activeSession?: CallSession | null;
}

const stopAndFadeAudio = (audio: HTMLAudioElement | null) => {
  if (!audio) return;
  const fadeStep = 0.2;
  const fadeInterval = 10;
  
  const fadeOut = setInterval(() => {
    if (audio.volume > fadeStep) {
      audio.volume -= fadeStep;
    } else {
      clearInterval(fadeOut);
      audio.pause();
      audio.currentTime = 0;
      // Reset volume for future plays if needed
      audio.volume = 1;
    }
  }, fadeInterval);
};

export function CallButton({
  client,
  groupId,
  currentUserId,
  onStartCall,
  memberCount: memberCountProp,
  targetUserId: targetUserIdProp,
  calling = false,
  activeSession,
}: CallButtonProps) {
  const t = useTranslations('CallButton');
  const [memberCount, setMemberCount] = useState<number | null>(
    memberCountProp ?? null,
  );
  const [targetUserId, setTargetUserId] = useState<UserId | null>(
    targetUserIdProp ?? null,
  );
  const [isMuted, setIsMuted] = useState(false);
  const [callState, setCallState] = useState<CallState>('idle');
  const [duration, setDuration] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  const DIAL_TONE_INTERVAL_MS = 4500;
  const currentToneAudio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!activeSession) return;
    if (activeSession.direction !== 'outgoing') return;
    // Only play tone before the call is answered
    if (callState === 'active' || callState === 'idle' || callState === 'ended') return;

    const playTone = () => {
      currentToneAudio.current = new Audio('/sfx/connecting-tone.mp3');
      currentToneAudio.current.play().catch((err) => {
        console.error('[call] failed to play connecting tone sfx', err);
      });
    };

    playTone();
    const interval = setInterval(playTone, DIAL_TONE_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      stopAndFadeAudio(currentToneAudio.current);
    };
  }, [activeSession, callState]);

  useEffect(() => {
    if (!activeSession) {
      setCallState('idle');
      setDuration(0);
      setIsExpanded(false);
      return;
    }

    setCallState(activeSession.state);
    
    // Trigger animation after render
    const frame = requestAnimationFrame(() => setIsExpanded(true));

    const unsubscribe = activeSession.onStateChange((state) => {
      setCallState(state);
    });

    return () => {
      cancelAnimationFrame(frame);
      unsubscribe();
    };
  }, [activeSession]);

  useEffect(() => {
    if (callState !== 'active') return;

    const interval = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [callState]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (memberCountProp !== undefined) {
      setMemberCount(memberCountProp);
    }
  }, [memberCountProp]);

  useEffect(() => {
    if (targetUserIdProp !== undefined) {
      setTargetUserId(targetUserIdProp);
    }
  }, [targetUserIdProp]);

  useEffect(() => {
    const shouldFetch =
      memberCountProp === undefined || targetUserIdProp === undefined;
    if (!shouldFetch) {
      return;
    }

    let active = true;

    client
      .getMembers(groupId)
      .then((result) => {
        if (!active) return;
        if (memberCountProp === undefined) {
          setMemberCount(result.members.length);
        }

        const fallbackTarget = result.members[0]?.userId ?? null;
        if (!currentUserId) {
          if (targetUserIdProp === undefined) {
            setTargetUserId(fallbackTarget);
          }
          return;
        }

        const otherMember = result.members.find(
          (member) => member.userId !== currentUserId,
        );
        if (targetUserIdProp === undefined) {
          setTargetUserId(otherMember?.userId ?? null);
        }
      })
      .catch((err) => {
        if (!active) return;
        console.error('[call] failed to load group members', err);
        setMemberCount(null);
        setTargetUserId(null);
      });

    return () => {
      active = false;
    };
  }, [client, currentUserId, groupId, memberCountProp, targetUserIdProp]);

  if (!client.calls) return null;

  // Active session controls must render regardless of the current route's
  // member count / target — the call may belong to a different group.
  if (activeSession) {
    const isLive = callState === 'active';
    const statusLabel = isLive ? t('live') : t('connecting');
    const statusTone = isLive
      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
      : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300';
    const showSpinner = !isLive;

    return (
      <>
        <button
          type="button"
          onClick={() => {
            const newMuted = !isMuted;
            setIsMuted(newMuted);
            activeSession.setMute(newMuted);
          }}
          className={`px-3 py-2 border-base transition-colors flex items-center gap-2 ${isMuted ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
          title={isMuted ? t('unmuteMicrophone') : t('muteMicrophone')}
        >
          {isMuted ? (
            <MicrophoneSlashIcon className="w-5 h-5" />
          ) : (
            <MicrophoneIcon className="w-5 h-5" />
          )}
          <span className="text-sm font-medium">
            {isMuted ? t('muted') : t('mute')}
          </span>
        </button>
        <div
          className={`flex items-center gap-2 px-3 py-2 border-base ${statusTone} transition-all duration-300 ${
            isExpanded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
          }`}
          role="status"
          aria-live="polite"
        >
          {showSpinner && (
            <span
              className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin"
              aria-hidden="true"
            />
          )}
          <span className="text-sm font-medium">
            {statusLabel}
            {isLive ? (
              <span className="tabular-nums inline-block min-w-[5ch] text-right">
                {` ${formatDuration(duration)}`}
              </span>
            ) : null}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            stopAndFadeAudio(currentToneAudio.current);
            new Audio('/sfx/call-end.mp3').play().catch((err) => {
              console.error('[call] failed to play call-end sfx', err);
            });
            activeSession.hangup();
          }}
          className="px-3 py-2 border-base bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 flex items-center justify-center gap-2 transition-all duration-300 ease-in-out"
          aria-label="Hang up"
          title={t('endCall')}
        >
          <PhoneXIcon aria-hidden="true" className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">{t('end')}</span>
        </button>
      </>
    );
  }

  // Guards for the "start call" button — only relevant when idle
  if (memberCount === null) return null;

  const isGroup = memberCount > 2;

  if (isGroup) {
    return (
      <Button
        type="button"
        variant="success"
        size="md"
        className="shadow-sm opacity-40 cursor-not-allowed"
        aria-label={t('call')}
        aria-disabled="true"
        title={t('groupCallsUnavailable')}
        disabled
      >
        <PhoneIcon aria-hidden="true" className="w-5 h-5" />
        <span className="text-sm font-semibold">{t('call')}</span>
      </Button>
    );
  }

  if (!targetUserId) return null;

  if (calling) {
    return (
      <button
        type="button"
        className="px-3 py-2 border-base bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 cursor-not-allowed inline-flex items-center gap-2"
        aria-label="Connecting"
        disabled
      >
        <span
          className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin"
          aria-hidden="true"
        />
        {t('connecting')}
      </button>
    );
  }

  const handleClick = () => {
    if (onStartCall) {
      onStartCall();
    } else if (client.calls && targetUserId) {
      client.calls.startCall({ groupId, toUserId: targetUserId });
    }
  };

  return (
    <Button
      type="button"
      onClick={handleClick}
      variant="success"
      size="md"
      className="shadow-sm"
      aria-label="Start call"
    >
      <PhoneIcon aria-hidden="true" className="w-5 h-5" />
      <span className="text-sm font-semibold">{t('call')}</span>
    </Button>
  );
}
