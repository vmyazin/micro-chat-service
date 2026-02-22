import type { GroupId, UserId } from '@microchat/client';
import { create } from 'zustand';

interface PresenceState {
  onlineUsersByGroup: Record<GroupId, Set<UserId>>;
  setOnlineUsers: (groupId: GroupId, userIds: UserId[]) => void;
  setUserOnline: (groupId: GroupId, userId: UserId) => void;
  setUserOffline: (groupId: GroupId, userId: UserId) => void;
  isUserOnline: (groupId: GroupId, userId: UserId) => boolean;
  getOnlineUserCount: (groupId: GroupId) => number;
}

export const usePresenceStore = create<PresenceState>()((set, get) => ({
  onlineUsersByGroup: {},

  setOnlineUsers: (groupId, userIds) => {
    set((state) => ({
      onlineUsersByGroup: {
        ...state.onlineUsersByGroup,
        [groupId]: new Set(userIds),
      },
    }));
  },

  setUserOnline: (groupId, userId) => {
    set((state) => {
      const currentSet = state.onlineUsersByGroup[groupId] || new Set();
      if (currentSet.has(userId)) return state; // no change

      const newSet = new Set(currentSet);
      newSet.add(userId);
      return {
        onlineUsersByGroup: {
          ...state.onlineUsersByGroup,
          [groupId]: newSet,
        },
      };
    });
  },

  setUserOffline: (groupId, userId) => {
    set((state) => {
      const currentSet = state.onlineUsersByGroup[groupId];
      if (!currentSet || !currentSet.has(userId)) return state; // no change

      const newSet = new Set(currentSet);
      newSet.delete(userId);
      return {
        onlineUsersByGroup: {
          ...state.onlineUsersByGroup,
          [groupId]: newSet,
        },
      };
    });
  },

  isUserOnline: (groupId, userId) => {
    const { onlineUsersByGroup } = get();
    return onlineUsersByGroup[groupId]?.has(userId) ?? false;
  },

  getOnlineUserCount: (groupId) => {
    const { onlineUsersByGroup } = get();
    return onlineUsersByGroup[groupId]?.size ?? 0;
  },
}));
