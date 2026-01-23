import { Hono } from 'hono';
import { type AuthEnv } from './routes/auth';
export interface AppEnv extends AuthEnv {
}
declare const app: Hono<{
    Bindings: AppEnv;
}, import("hono/types").BlankSchema, "/">;
export { app };
//# sourceMappingURL=app.d.ts.map