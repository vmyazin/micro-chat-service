import { Hono } from 'hono';
export interface ChallengeData {
    challenge: string;
    userId?: string;
    displayName?: string;
    expiresAt: number;
    type: 'registration' | 'authentication';
}
export interface AuthEnv {
    DB: import('../db/client').D1Database;
    CHALLENGE_STORE: Map<string, ChallengeData>;
    RP_ID: string;
    RP_NAME: string;
    RP_ORIGIN: string;
}
declare const authRouter: Hono<{
    Bindings: AuthEnv;
}, import("hono/types").BlankSchema, "/">;
export { authRouter };
//# sourceMappingURL=auth.d.ts.map