'use client';

import type { CallSession, IncomingCallSession, UserId } from '@microchat/client';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

type CallState = 'idle' | 'calling' | 'in-call' | 'incoming';

interface CallStore {
  activeSession: CallSession | null;
  setActiveSession: (session: CallSession | null) => void;

  incomingSession: IncomingCallSession | null;
  setIncomingSession: (session: IncomingCallSession | null) => void;

  callState: CallState;
  setCallState: (state: CallState) => void;

  isCalling: boolean;
  setIsCalling: (calling: boolean) => void;

  targetUserId: UserId | null;
  setTargetUserId: (id: UserId | null) => void;

  targetUserName: string | null;
  setTargetUserName: (name: string | null) => void;

  memberCount: number | null;
  setMemberCount: (count: number | null) => void;

  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  toggleMute: () => void;

  duration: number;
  setDuration: (duration: number) => void;
  incrementDuration: () => void;

  clearCallState: () => void;
}

export const useCallStore = create<CallStore>()(
  devtools(
    (set, get) => ({
      activeSession: null,
      setActiveSession: (session) => set({ activeSession: session }, false, 'setActiveSession'),

      incomingSession: null,
      setIncomingSession: (session) => set({ incomingSession: session }, false, 'setIncomingSession'),

      callState: 'idle',
      setCallState: (state) => set({ callState: state }, false, 'setCallState'),

      isCalling: false,
      setIsCalling: (calling) => set({ isCalling: calling }, false, 'setIsCalling'),

      targetUserId: null,
      setTargetUserId: (id) => set({ targetUserId: id }, false, 'setTargetUserId'),

      targetUserName: null,
      setTargetUserName: (name) => set({ targetUserName: name }, false, 'setTargetUserName'),

      memberCount: null,
      setMemberCount: (count) => set({ memberCount: count }, false, 'setMemberCount'),

      isMuted: false,
      setIsMuted: (muted) => set({ isMuted: muted }, false, 'setIsMuted'),
      toggleMute: () => set((state) => ({ isMuted: !state.isMuted }), false, 'toggleMute'),

      duration: 0,
      setDuration: (duration) => set({ duration }, false, 'setDuration'),
      incrementDuration: () => set((state) => ({ duration: state.duration + 1 }), false, 'incrementDuration'),

      clearCallState: () =>
        set(
          {
            activeSession: null,
            incomingSession: null,
            callState: 'idle',
            isCalling: false,
            targetUserId: null,
            targetUserName: null,
            memberCount: null,
            isMuted: false,
            duration: 0,
          },
          false,
          'clearCallState'
        ),
    }),
    { name: 'call-store' }
  )
);
