'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import GroupList from '@/components/GroupList';
import NewGroupDialog from '@/components/NewGroupDialog';

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNewGroupDialog, setShowNewGroupDialog] = useState(false);

  const selectedGroupId = params?.groupId as string | undefined;

  function handleNewGroup() {
    setShowNewGroupDialog(true);
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        // biome-ignore lint/a11y/noStaticElementInteractions: modal backdrop dismiss pattern
        <div
          role="presentation"
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-[300px] brutal-border border-r-0 lg:border-r
          bg-[var(--background)]
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar header */}
          <div className="flex items-center justify-between p-4 border-b-[3px] border-[var(--border-color)]">
            <h2 className="font-bold text-lg">Groups</h2>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Close sidebar"
            >
              <CloseIcon />
            </button>
          </div>

          {/* Sidebar content */}
          <div className="flex-1 overflow-y-auto p-4">
            <GroupList
              onNewGroup={handleNewGroup}
              selectedGroupId={selectedGroupId}
            />
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header with toggle */}
        <div className="lg:hidden flex items-center p-4 border-b-[3px] border-[var(--border-color)]">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="p-2 brutal-border hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Open sidebar"
          >
            <MenuIcon />
          </button>
          <span className="ml-3 font-bold">MicroChat</span>
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-hidden">{children}</div>
      </main>

      {/* New Group Dialog */}
      <NewGroupDialog
        open={showNewGroupDialog}
        onClose={() => setShowNewGroupDialog(false)}
      />
    </div>
  );
}

function MenuIcon() {
  return (
    <svg
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
