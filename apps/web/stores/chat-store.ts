'use client';

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

interface ChatStore {
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (status: ConnectionStatus) => void;

  showSettings: boolean;
  setShowSettings: (show: boolean) => void;

  deleteConfirmId: string | null;
  setDeleteConfirmId: (id: string | null) => void;

  deleting: boolean;
  setDeleting: (deleting: boolean) => void;

  highlightedIds: Set<string>;
  addHighlightedId: (id: string) => void;
  removeHighlightedId: (id: string) => void;
  toggleHighlightedId: (id: string) => void;
  clearHighlightedIds: () => void;
}

const storageKey = 'microchat-highlighted-messages';

export const useChatStore = create<ChatStore>()(
  devtools(
    persist(
      (set, get) => ({
        connectionStatus: 'disconnected',
        setConnectionStatus: (status) => set({ connectionStatus: status }, false, 'setConnectionStatus'),

        showSettings: false,
        setShowSettings: (show) => set({ showSettings: show }, false, 'setShowSettings'),

        deleteConfirmId: null,
        setDeleteConfirmId: (id) => set({ deleteConfirmId: id }, false, 'setDeleteConfirmId'),

        deleting: false,
        setDeleting: (deleting) => set({ deleting }, false, 'setDeleting'),

        highlightedIds: new Set<string>(),
        addHighlightedId: (id) =>
          set(
            (state) => ({
              highlightedIds: new Set([...state.highlightedIds, id]),
            }),
            false,
            'addHighlightedId'
          ),
        removeHighlightedId: (id) =>
          set(
            (state) => {
              const next = new Set(state.highlightedIds);
              next.delete(id);
              return { highlightedIds: next };
            },
            false,
            'removeHighlightedId'
          ),
        toggleHighlightedId: (id) =>
          set(
            (state) => {
              const next = new Set(state.highlightedIds);
              if (next.has(id)) {
                next.delete(id);
              } else {
                next.add(id);
              }
              return { highlightedIds: next };
            },
            false,
            'toggleHighlightedId'
          ),
        clearHighlightedIds: () => set({ highlightedIds: new Set<string>() }, false, 'clearHighlightedIds'),
      }),
      {
        name: storageKey,
        partialize: (state) => ({
          highlightedIds: Array.from(state.highlightedIds),
        }),
        merge: (persisted, current) => {
          const persistedData = persisted as { highlightedIds?: string[] } | undefined;
          return {
            ...current,
            // Reset transient state that shouldn't persist
            connectionStatus: 'disconnected',
            showSettings: false,
            deleteConfirmId: null,
            deleting: false,
            // Only restore highlighted IDs from storage
            highlightedIds: new Set(persistedData?.highlightedIds ?? []),
          };
        },
      }
    ),
    { name: 'chat-store' }
  )
);
