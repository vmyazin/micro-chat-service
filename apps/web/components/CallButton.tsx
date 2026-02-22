'use client';

import {
  Microphone,
  MicrophoneSlash,
  Phone,
  PhoneX,
} from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import type { CallSession, CallState, GroupId, MicroChatClient, UserId } from '@microchat/client';

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
  if (memberCount === null) return null;
  if (memberCount > 2) return null;
  if (!targetUserId) return null;

  if (activeSession) {
    return (
      <>
        <button
          type="button"
          onClick={() => {
            const newMuted = !isMuted;
            setIsMuted(newMuted);
            activeSession.setMute(newMuted);
          }}
          className={`p-2 border-base transition-colors ${isMuted ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
          title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {isMuted ? (
            <MicrophoneSlash className="w-5 h-5" />
          ) : (
            <Microphone className="w-5 h-5" />
          )}
        </button>
        <button
          type="button"
          onClick={() => activeSession.hangup()}
          className="p-2 border-base bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 flex items-center justify-center transition-all duration-300 ease-in-out"
          aria-label="Hang up"
          title="End call"
        >
          <PhoneX aria-hidden="true" className="w-5 h-5 shrink-0" />
          <span 
            className={`whitespace-nowrap font-medium text-sm overflow-hidden transition-all duration-500 ease-out flex items-center ${
              isExpanded ? 'max-w-[100px] opacity-100 ml-2 mr-1' : 'max-w-0 opacity-0 ml-0 mr-0'
            }`}
          >
            {callState === 'active' ? formatDuration(duration) : 'Calling...'}
          </span>
        </button>
      </>
    );
  }

  if (calling) {
    return (
      <button
        type="button"
        className="px-3 py-2 border-base bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 cursor-not-allowed"
        aria-label="Calling"
        disabled
      >
        Calling...
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
    <button
      type="button"
      onClick={handleClick}
      className="p-2 border-base hover:bg-gray-100 dark:hover:bg-gray-800"
      aria-label="Start call"
    >
      <Phone aria-hidden="true" className="w-5 h-5" />
    </button>
  );
}
