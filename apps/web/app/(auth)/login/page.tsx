// apps/web/app/(auth)/login/page.tsx
'use client';

import { AuthClient } from '@microchat/client';
import { SpinnerGapIcon } from '@phosphor-icons/react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Button } from '@/components/Button';

type LoginState = 'idle' | 'loading' | 'unsupported';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/chat';
  const [state, setState] = useState<LoginState>('idle');
  const [error, setError] = useState<string | null>(null);

  const isWebAuthnSupported =
    typeof window !== 'undefined' && window.PublicKeyCredential !== undefined;

  async function handleLogin() {
    if (!isWebAuthnSupported) {
      setState('unsupported');
      return;
    }

    setError(null);
    setState('loading');

    try {
      const authClient = new AuthClient(process.env.NEXT_PUBLIC_API_URL || '');

      const options = await authClient.getLoginOptions();

      const publicKeyOptions: PublicKeyCredentialRequestOptions = {
        challenge: base64urlToBuffer(options.challenge),
        rpId: options.rpId,
        timeout: options.timeout,
        userVerification:
          (options.userVerification as UserVerificationRequirement) ||
          'preferred',
        allowCredentials: options.allowCredentials?.map((cred) => ({
          id: base64urlToBuffer(cred.id),
          type: cred.type,
        })),
      };

      const credential = await navigator.credentials.get({
        publicKey: publicKeyOptions,
      });

      if (!credential) {
        throw new Error('No credential returned');
      }

      await authClient.verifyLogin(
        credential as PublicKeyCredential,
        options.challenge,
      );

      router.push(redirectTo);
    } catch (err) {
      setState('idle');
      setError(err instanceof Error ? err.message : 'Authentication failed');
    }
  }

  if (!isWebAuthnSupported && typeof window !== 'undefined') {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="card-base w-full max-w-md text-center">
          <h1 className="text-2xl font-bold mb-4">Browser Not Supported</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Your browser does not support passkeys (WebAuthn). Please use a
            modern browser like Chrome, Firefox, Safari, or Edge.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card-base w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-8">Sign In</h1>

        <div className="space-y-6">
          {error && (
            <div className="p-3 border-base bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <Button
            variant="primary"
            type="button"
            onClick={handleLogin}
            disabled={state === 'loading'}
            className="w-full flex items-center justify-center ga disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {state === 'loading' ? (
              <>
                <LoadingSpinner />
                Authenticating...
              </>
            ) : (
              'Sign in with Passkey'
            )}
          </Button>

          <p className="text-center text-sm text-gray-600 dark:text-gray-400">
            Don&apos;t have an account?{' '}
            <Link
              href={
                redirectTo !== '/chat'
                  ? `/register?redirect=${encodeURIComponent(redirectTo)}`
                  : '/register'
              }
              className="font-semibold text-primary hover:underline"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginPageSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card-base w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-8">Sign In</h1>
        <div className="space-y-6">
          <div className="h-12 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
        </div>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return <SpinnerGapIcon aria-hidden="true" className="animate-spin h-5 w-5" />;
}

function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
