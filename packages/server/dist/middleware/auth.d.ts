import type { Context, Next } from 'hono';
import type { UserId } from '@microchat/shared';
import { type D1Database } from '../db/client';
export interface AuthUser {
    id: UserId;
    displayName: string;
}
export interface AuthVariables {
    user: AuthUser;
}
export interface AuthEnv {
    DB: D1Database;
}
export declare function requireAuth(c: Context<{
    Bindings: AuthEnv;
    Variables: AuthVariables;
}>, next: Next): Promise<Response | void>;
//# sourceMappingURL=auth.d.ts.map