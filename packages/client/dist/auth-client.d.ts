import type { UserId } from '@microchat/shared';
export interface RegisterOptions {
    challenge: string;
    rp: {
        name: string;
        id: string;
    };
    user: {
        id: string;
        name: string;
        displayName: string;
    };
    pubKeyCredParams: {
        alg: number;
        type: 'public-key';
    }[];
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
    allowCredentials?: {
        id: string;
        type: 'public-key';
    }[];
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
export declare class AuthClient {
    private baseUrl;
    constructor(baseUrl: string);
    getRegisterOptions(displayName: string): Promise<RegisterOptions>;
    verifyRegistration(response: PublicKeyCredential, challenge: string): Promise<AuthResult>;
    getLoginOptions(username?: string): Promise<LoginOptions>;
    verifyLogin(response: PublicKeyCredential, challenge: string): Promise<AuthResult>;
    getCurrentUser(): Promise<CurrentUser>;
    private bufferToBase64url;
}
//# sourceMappingURL=auth-client.d.ts.map