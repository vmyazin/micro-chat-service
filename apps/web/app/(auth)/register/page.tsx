// apps/web/app/(auth)/register/page.tsx
'use client';

import { AuthClient } from '@microchat/client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Button } from '@/components/Button';

type RegistrationState = 'idle' | 'loading' | 'unsupported';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/chat';
  const [displayName, setDisplayName] = useState('');
  const [state, setState] = useState<RegistrationState>('idle');
  const [error, setError] = useState<string | null>(null);

  const isWebAuthnSupported =
    typeof window !== 'undefined' && window.PublicKeyCredential !== undefined;

  async function handleRegister() {
    if (!displayName.trim()) {
      setError('Please enter a display name');
      return;
    }

    if (!isWebAuthnSupported) {
      setState('unsupported');
      return;
    }

    setError(null);
    setState('loading');

    try {
      const authClient = new AuthClient(process.env.NEXT_PUBLIC_API_URL || '');

      const options = await authClient.getRegisterOptions(displayName.trim());

      const publicKeyOptions: PublicKeyCredentialCreationOptions = {
        challenge: base64urlToBuffer(options.challenge),
        rp: options.rp,
        user: {
          id: base64urlToBuffer(options.user.id),
          name: options.user.name,
          displayName: options.user.displayName,
        },
        pubKeyCredParams: options.pubKeyCredParams,
        timeout: options.timeout,
        attestation: options.attestation as AttestationConveyancePreference,
        authenticatorSelection: options.authenticatorSelection
          ? {
              residentKey: options.authenticatorSelection
                .residentKey as ResidentKeyRequirement,
              userVerification: options.authenticatorSelection
                .userVerification as UserVerificationRequirement,
            }
          : undefined,
      };

      const credential = await navigator.credentials.create({
        publicKey: publicKeyOptions,
      });

      if (!credential) {
        throw new Error('No credential returned');
      }

      await authClient.verifyRegistration(
        credential as PublicKeyCredential,
        options.challenge,
      );

      router.push(redirectTo);
    } catch (err) {
      setState('idle');
      setError(err instanceof Error ? err.message : 'Registration failed');
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
        <h1 className="text-2xl font-bold text-center mb-8">Create Account</h1>

        <div className="space-y-6">
          <div>
            <label
              htmlFor="displayName"
              className="block text-sm font-semibold mb-2"
            >
              Display Name
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your name"
              disabled={state === 'loading'}
              className="w-full px-4 py-3 border-base bg-transparent focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRegister();
              }}
            />
          </div>

          {error && (
            <div className="p-3 border-base bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <Button
            variant="primary"
            type="button"
            onClick={handleRegister}
            disabled={state === 'loading'}
            className="w-full flex items-center justify-center ga disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {state === 'loading' ? (
              <>
                <LoadingSpinner />
                Creating passkey...
              </>
            ) : (
              'Register with Passkey'
            )}
          </Button>

          <p className="text-center text-sm text-gray-600 dark:text-gray-400">
            Already have an account?{' '}
            <Link
              href={
                redirectTo !== '/chat'
                  ? `/login?redirect=${encodeURIComponent(redirectTo)}`
                  : '/login'
              }
              className="font-semibold text-primary hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterPageSkeleton />}>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterPageSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card-base w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-8">Create Account</h1>
        <div className="space-y-6">
          <div className="h-12 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
          <div className="h-12 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
        </div>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg
      aria-hidden="true"
      className="animate-spin h-5 w-5"
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
