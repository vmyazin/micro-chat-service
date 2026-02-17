import type { UserId } from '@microchat/shared';

export interface RegisterOptions {
  challenge: string;
  rp: { name: string; id: string };
  user: { id: string; name: string; displayName: string };
  pubKeyCredParams: { alg: number; type: 'public-key' }[];
  timeout: number;
  attestation: string;
  authenticatorSelection?: {
    residentKey?: string;
    userVerification?: string;
  };
}

export interface LoginOptions {
  challenge: string;
  timeout: number;
  rpId: string;
  allowCredentials?: { id: string; type: 'public-key' }[];
  userVerification?: string;
}

export interface AuthResult {
  verified: boolean;
  userId: UserId;
}

export interface CurrentUser {
  userId: UserId;
  displayName: string;
}

export class AuthClient {
  constructor(private baseUrl: string) {}

  async getRegisterOptions(displayName: string): Promise<RegisterOptions> {
    const response = await fetch(`${this.baseUrl}/api/auth/register/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName }),
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get registration options');
    }

    return response.json();
  }

  async verifyRegistration(
    response: PublicKeyCredential,
    challenge: string,
  ): Promise<AuthResult> {
    const credential = response.response as AuthenticatorAttestationResponse;

    const body = {
      challenge,
      response: {
        id: response.id,
        rawId: this.bufferToBase64url(response.rawId),
        response: {
          clientDataJSON: this.bufferToBase64url(credential.clientDataJSON),
          attestationObject: this.bufferToBase64url(
            credential.attestationObject,
          ),
        },
        type: response.type,
      },
    };

    const res = await fetch(`${this.baseUrl}/api/auth/register/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Registration verification failed');
    }

    return res.json();
  }

  async getLoginOptions(username?: string): Promise<LoginOptions> {
    const response = await fetch(`${this.baseUrl}/api/auth/login/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get login options');
    }

    return response.json();
  }

  async verifyLogin(
    response: PublicKeyCredential,
    challenge: string,
  ): Promise<AuthResult> {
    const assertion = response.response as AuthenticatorAssertionResponse;

    const body = {
      challenge,
      response: {
        id: response.id,
        rawId: this.bufferToBase64url(response.rawId),
        response: {
          clientDataJSON: this.bufferToBase64url(assertion.clientDataJSON),
          authenticatorData: this.bufferToBase64url(
            assertion.authenticatorData,
          ),
          signature: this.bufferToBase64url(assertion.signature),
          userHandle: assertion.userHandle
            ? this.bufferToBase64url(assertion.userHandle)
            : null,
        },
        type: response.type,
      },
    };

    const res = await fetch(`${this.baseUrl}/api/auth/login/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Login verification failed');
    }

    return res.json();
  }

  async getCurrentUser(): Promise<CurrentUser> {
    const response = await fetch(`${this.baseUrl}/api/auth/me`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get current user');
    }

    return response.json();
  }

  private bufferToBase64url(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
}
