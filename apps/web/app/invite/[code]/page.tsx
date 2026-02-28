'use client';

import { SpinnerGapIcon } from '@phosphor-icons/react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/Button';
import { useAcceptInvite } from '@/hooks/useAcceptInvite';
import { useTreeKEM } from '@/hooks/useTreeKEM';

type InviteState = 'loading' | 'tree-init' | 'error' | 'success';

export default function InvitePage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const [state, setState] = useState<InviteState>('loading');
  const [error, setError] = useState<string | null>(null);

  const acceptInvite = useAcceptInvite();
  const { joinGroupTree, getIdentityKey } = useTreeKEM();
  const hasAttemptedRef = useRef(false);

  useEffect(() => {
    const code = params.code;
    if (!code || hasAttemptedRef.current) return;
    hasAttemptedRef.current = true;

    const run = async () => {
      // Export our identity public key so existing members can generate a TreeKEM Welcome for us.
      let publicKey: string | undefined;
      try {
        const keyPair = await getIdentityKey();
        const pubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey));
        publicKey = btoa(String.fromCharCode(...pubRaw));
      } catch {
        // Non-fatal — invite acceptance works without TreeKEM
      }

      const result = await acceptInvite.mutateAsync({ code, publicKey });
      setState('tree-init');

      const timeout = new Promise<void>((resolve) => setTimeout(resolve, 5000));
      await Promise.race([
        joinGroupTree(result.groupId),
        timeout,
      ]).catch((err) => {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[TreeKEM] joinGroupTree failed during invite acceptance:', err);
        }
      });

      setState('success');
      router.replace(`/chat/${result.groupId}`);
    };

    run().catch((err) => {
      setState('error');
      setError(err instanceof Error ? err.message : 'Failed to accept invite');
    });
  }, [params.code, router, acceptInvite.mutateAsync, joinGroupTree, getIdentityKey]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card-base w-full max-w-md text-center">
        {state === 'loading' && (
          <>
            <LoadingSpinner />
            <h1 className="text-xl font-bold mt-4">Joining group...</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Accepting your invite
            </p>
          </>
        )}

        {state === 'tree-init' && (
          <>
            <LoadingSpinner />
            <h1 className="text-xl font-bold mt-4">
              Setting up encrypted session…
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Just a moment
            </p>
          </>
        )}

        {state === 'success' && (
          <>
            <h1 className="text-xl font-bold">You're in!</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Redirecting to the group...
            </p>
          </>
        )}

        {state === 'error' && (
          <>
            <h1 className="text-xl font-bold mb-4">Invite Failed</h1>
            <div className="p-3 border-base bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm mb-4">
              {error}
            </div>
            <Button
              variant="ghost"
              type="button"
              onClick={() => router.push('/chat')}
              className="btn-base"
            >
              Go to Chat
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <SpinnerGapIcon
      aria-hidden="true"
      className="animate-spin h-8 w-8 mx-auto"
    />
  );
}
