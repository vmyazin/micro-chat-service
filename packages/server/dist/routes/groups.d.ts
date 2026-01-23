import { Hono } from 'hono';
import { type D1Database } from '../db/client';
import { type AuthVariables, type AuthEnv as AuthMiddlewareEnv } from '../middleware/auth';
export interface GroupsEnv extends AuthMiddlewareEnv {
    DB: D1Database;
}
declare const groupsRouter: Hono<{
    Bindings: GroupsEnv;
    Variables: AuthVariables;
}, import("hono/types").BlankSchema, "/">;
export { groupsRouter };
//# sourceMappingURL=groups.d.ts.map