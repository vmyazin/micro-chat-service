"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthClient = void 0;
class AuthClient {
    baseUrl;
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }
    async getRegisterOptions(displayName) {
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
    async verifyRegistration(response, challenge) {
        const credential = response.response;
        const body = {
            challenge,
            response: {
                id: response.id,
                rawId: this.bufferToBase64url(response.rawId),
                response: {
                    clientDataJSON: this.bufferToBase64url(credential.clientDataJSON),
                    attestationObject: this.bufferToBase64url(credential.attestationObject),
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
    async getLoginOptions(username) {
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
    async verifyLogin(response, challenge) {
        const assertion = response.response;
        const body = {
            challenge,
            response: {
                id: response.id,
                rawId: this.bufferToBase64url(response.rawId),
                response: {
                    clientDataJSON: this.bufferToBase64url(assertion.clientDataJSON),
                    authenticatorData: this.bufferToBase64url(assertion.authenticatorData),
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
    bufferToBase64url(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }
}
exports.AuthClient = AuthClient;
//# sourceMappingURL=auth-client.js.map