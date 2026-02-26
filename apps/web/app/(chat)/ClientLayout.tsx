'use client';

import type { GroupId } from '@microchat/client';
import { AuthClient } from '@microchat/client';
import {
  ListIcon,
  SignOutIcon,
  SpinnerGapIcon,
  UserIcon,
  XIcon,
} from '@phosphor-icons/react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/Button';
import { CallFaviconUpdater } from '@/components/CallFaviconUpdater';
import GroupList from '@/components/GroupList';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import NewGroupDialog from '@/components/NewGroupDialog';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useUiStore } from '@/stores/ui-store';

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const t = useTranslations('ChatLayout');

  // UI state from Zustand store
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);
  const showNewGroupDialog = useUiStore((state) => state.showNewGroupDialog);
  const setShowNewGroupDialog = useUiStore(
    (state) => state.setShowNewGroupDialog,
  );
  const refreshGroupList = useUiStore((state) => state.refreshGroupList);

  const selectedGroupId = params?.groupId as string | undefined;
  const { data: currentUser } = useCurrentUser();

  function handleNewGroup() {
    setShowNewGroupDialog(true);
  }

  function handleGroupCreated() {
    refreshGroupList();
  }

  // Preserve global WebSocket connection universally
  useWebSocket(selectedGroupId as GroupId | undefined);

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
          w-[300px] border-base border-r-0 lg:border-r
          bg-(--sidebar-background)
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-(--border-color)">
            <Image
              src="/images/mc-logo-vector-8863.svg"
              alt="MicroChat Logo"
              width={48}
              height={48}
              className="h-12 w-auto"
              priority
            />
            <Button
              variant="ghost"
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Close sidebar"
            >
              <XIcon className="w-5 h-5" />
            </Button>
          </div>

          {/* Sidebar content */}
          <div className="flex-1 overflow-y-auto p-4">
            <GroupList
              onNewGroup={handleNewGroup}
              selectedGroupId={selectedGroupId}
            />
          </div>

          {/* Sign Out button */}
          <div className="p-4 border-t border-(--border-color) space-y-2">
            <div className="flex items-center justify-between gap-2 px-2">
              <a href="/" className="text-sm font-medium hover:underline">
                {t('homePage')}
              </a>
              <LanguageSwitcher />
            </div>
            <div className="flex items-center justify-between gap-4">
              {currentUser?.displayName && (
                <div
                  className="flex items-center gap-1.5 max-w-[50%] overflow-hidden text-sm font-medium text-gray-700 dark:text-gray-300"
                  title={currentUser.displayName}
                >
                  <UserIcon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{currentUser.displayName}</span>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="flex-1 min-w-0 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSigningOut ? (
                  <>
                    <SignOutSpinner />
                    <span className="truncate">{t('signingOut')}</span>
                  </>
                ) : (
                  <>
                    <SignOutIcon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{t('signOut')}</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header with toggle */}
        <div className="lg:hidden flex items-center p-4 border-b border-(--border-color) shrink-0">
          <Button
            variant="ghost"
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="p-2 border-base hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Open sidebar"
          >
            <ListIcon className="w-5 h-5" />
          </Button>
          <span className="ml-3 font-bold">MicroChat</span>
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {children}
        </div>
      </main>

      {/* New Group Dialog */}
      <NewGroupDialog
        open={showNewGroupDialog}
        onClose={() => setShowNewGroupDialog(false)}
        onGroupCreated={handleGroupCreated}
      />

      <CallFaviconUpdater />
    </div>
  );
}

function SignOutSpinner() {
  return <SpinnerGapIcon aria-hidden="true" className="animate-spin h-4 w-4" />;
}
