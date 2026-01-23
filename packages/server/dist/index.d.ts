export { app } from './app';
import { type AppEnv } from './app';
import { type RetentionEnv } from './jobs/retention';
type Env = AppEnv & RetentionEnv;
declare const _default: {
    fetch: (request: Request, Env?: {} | AppEnv | undefined, executionCtx?: import("hono").ExecutionContext) => Response | Promise<Response>;
    scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void>;
};
export default _default;
//# sourceMappingURL=index.d.ts.map