'use client';

import { AuthClient } from '@microchat/client';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import GroupList from '@/components/GroupList';
import NewGroupDialog from '@/components/NewGroupDialog';

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNewGroupDialog, setShowNewGroupDialog] = useState(false);
  const [groupListKey, setGroupListKey] = useState(0);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const selectedGroupId = params?.groupId as string | undefined;

  function handleNewGroup() {
    setShowNewGroupDialog(true);
  }

  function handleGroupCreated() {
    setGroupListKey((k) => k + 1);
  }

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      const authClient = new AuthClient(process.env.NEXT_PUBLIC_API_URL || '');
      await authClient.logout();
      router.push('/login');
    } catch {
      setIsSigningOut(false);
    }
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
          bg-[var(--sidebar-background)]
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-color)]">
            <img src="/images/mc-logo-vector-8863.svg" alt="MicroChat Logo" className="h-12 w-auto" />
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
              refreshKey={groupListKey}
            />
          </div>

          {/* Sign Out button */}
          <div className="p-4 border-t border-[var(--border-color)] space-y-2">
            <a
              href="/"
              className="w-full flex items-center justify-center gap-2 p-2"
            >
              Home Page
            </a>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="w-full brutal-btn brutal-btn-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSigningOut ? (
                <>
                  <SignOutSpinner />
                  Signing out...
                </>
              ) : (
                <>
                  <SignOutIcon />
                  Sign Out
                </>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header with toggle */}
        <div className="lg:hidden flex items-center p-4 border-b border-[var(--border-color)]">
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
        onGroupCreated={handleGroupCreated}
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

function SignOutIcon() {
  return (
    <svg
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function SignOutSpinner() {
  return (
    <svg
      aria-hidden="true"
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
