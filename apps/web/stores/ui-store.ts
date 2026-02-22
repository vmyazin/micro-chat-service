'use client';

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface UiStore {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  showNewGroupDialog: boolean;
  setShowNewGroupDialog: (show: boolean) => void;

  groupListKey: number;
  refreshGroupList: () => void;
}

export const useUiStore = create<UiStore>()(
  devtools(
    (set) => ({
      sidebarOpen: false,
      setSidebarOpen: (open) => set({ sidebarOpen: open }, false, 'setSidebarOpen'),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen }), false, 'toggleSidebar'),

      showNewGroupDialog: false,
      setShowNewGroupDialog: (show) => set({ showNewGroupDialog: show }, false, 'setShowNewGroupDialog'),

      groupListKey: 0,
      refreshGroupList: () => set((state) => ({ groupListKey: state.groupListKey + 1 }), false, 'refreshGroupList'),
    }),
    { name: 'ui-store' }
  )
);
