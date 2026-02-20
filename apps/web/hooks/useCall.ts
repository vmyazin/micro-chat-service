'use client';

import { useEffect, useState } from 'react';
import {
  type CallState,
  type GroupId,
  MicroChatClient,
  type UserId,
  type WebSocketEvent,
} from '@microchat/client';

type IncomingCallEvent = Extract<WebSocketEvent, { type: 'callOffer' }>;
type MissedCallEvent = Extract<WebSocketEvent, { type: 'callEnd' }>;

interface UseCallOptions {
  groupId?: GroupId;
  currentUserId?: UserId | null;
}

interface UseCallState {
  client: MicroChatClient;
  callState: CallState;
  incomingCall: IncomingCallEvent | null;
  missedCall: MissedCallEvent | null;
  memberCount: number | null;
  targetUserId: UserId | null;
}

export function useCall(options: UseCallOptions = {}): UseCallState {
  const [client] = useState(
    () =>
      new MicroChatClient({
        baseUrl: process.env.NEXT_PUBLIC_API_URL || '',
        wsUrl: process.env.NEXT_PUBLIC_WS_URL,
        enableVoiceCalls: true,
      }),
  );
  const [callState, setCallState] = useState<CallState>('idle');
  const [incomingCall, setIncomingCall] = useState<IncomingCallEvent | null>(
    null,
  );
  const [missedCall, setMissedCall] = useState<MissedCallEvent | null>(null);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [targetUserId, setTargetUserId] = useState<UserId | null>(null);

  useEffect(() => {
    client.connect();
    return () => client.disconnect();
  }, [client]);

  useEffect(() => {
    if (!client.calls) return;

    const offIncoming = client.calls.onIncomingCall((event) => {
      console.log('[call] incoming call event', event);
      setIncomingCall(event);
      setCallState('ringing-in');
    });

    const offMissed = client.calls.onMissedCall((event) => {
      console.log('[call] missed call event', event);
      setMissedCall(event);
      setCallState('ended');
    });

    return () => {
      offIncoming();
      offMissed();
    };
  }, [client]);

  useEffect(() => {
    if (!options.groupId) {
      setMemberCount(null);
      setTargetUserId(null);
      return;
    }

    let active = true;

    client
      .getMembers(options.groupId)
      .then((result) => {
        if (!active) return;
        setMemberCount(result.members.length);

        const fallbackTarget = result.members[0]?.userId ?? null;
        if (!options.currentUserId) {
          setTargetUserId(fallbackTarget);
          return;
        }

        const otherMember = result.members.find(
          (member) => member.userId !== options.currentUserId,
        );
        setTargetUserId(otherMember?.userId ?? null);
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
  }, [client, options.currentUserId, options.groupId]);

  return {
    client,
    callState,
    incomingCall,
    missedCall,
    memberCount,
    targetUserId,
  };
}
