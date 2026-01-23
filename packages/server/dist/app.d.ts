import { Hono } from 'hono';
import { type AuthEnv } from './routes/auth';
import { type GroupsEnv } from './routes/groups';
export interface AppEnv extends AuthEnv, GroupsEnv {
}
declare const app: Hono<{
    Bindings: AppEnv;
}, import("hono/types").BlankSchema, "/">;
export { app };
//# sourceMappingURL=app.d.ts.map