'use client';

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
          className={`p-2 brutal-border transition-colors ${isMuted ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
          title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {isMuted ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          )}
        </button>
        <button
          type="button"
          onClick={() => activeSession.hangup()}
          className="p-2 brutal-border bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 flex items-center justify-center transition-all duration-300 ease-in-out"
          aria-label="Hang up"
          title="End call"
        >
          <svg
            aria-hidden="true"
            className="w-5 h-5 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.516l2.257-1.13a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
          </svg>
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
        className="px-3 py-2 brutal-border bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 cursor-not-allowed"
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
      className="p-2 brutal-border hover:bg-gray-100 dark:hover:bg-gray-800"
      aria-label="Start call"
    >
      <svg
        aria-hidden="true"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M2 4.5A2.5 2.5 0 014.5 2h2.1a2 2 0 011.9 1.4l.9 2.7a2 2 0 01-.5 2l-1.2 1.2a14 14 0 006.6 6.6l1.2-1.2a2 2 0 012-.5l2.7.9a2 2 0 011.4 1.9v2.1A2.5 2.5 0 0119.5 22h-.5C9.3 22 2 14.7 2 5v-.5z"
        />
      </svg>
    </button>
  );
}
