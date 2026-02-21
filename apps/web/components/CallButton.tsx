'use client';

import { useEffect, useState } from 'react';
import type { GroupId, MicroChatClient, UserId } from '@microchat/client';

interface CallButtonProps {
  client: MicroChatClient;
  groupId: GroupId;
  currentUserId?: UserId | null;
  onStartCall?: () => void;
  memberCount?: number | null;
  targetUserId?: UserId | null;
}

export function CallButton({
  client,
  groupId,
  currentUserId,
  onStartCall,
  memberCount: memberCountProp,
  targetUserId: targetUserIdProp,
}: CallButtonProps) {
  const [memberCount, setMemberCount] = useState<number | null>(
    memberCountProp ?? null,
  );
  const [targetUserId, setTargetUserId] = useState<UserId | null>(
    targetUserIdProp ?? null,
  );

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
