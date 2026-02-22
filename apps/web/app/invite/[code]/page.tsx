'use client';

import { MicroChatClient } from '@microchat/client';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type InviteState = 'loading' | 'error' | 'success';

export default function InvitePage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const [state, setState] = useState<InviteState>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = params.code;
    if (!code) return;

    const client = new MicroChatClient({
      baseUrl: process.env.NEXT_PUBLIC_API_URL || '',
    });

    client
      .acceptInvite(code)
      .then((result) => {
        setState('success');
        router.replace(`/chat/${result.groupId}`);
      })
      .catch((err) => {
        setState('error');
        setError(
          err instanceof Error ? err.message : 'Failed to accept invite',
        );
      });
  }, [params.code, router]);

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
            <button
              type="button"
              onClick={() => router.push('/chat')}
              className="btn-base"
            >
              Go to Chat
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg
      aria-hidden="true"
      className="animate-spin h-8 w-8 mx-auto"
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
