// MicroChat Server Entry Point
export { app } from './app';
export { ChatHub } from './websocket/chat-hub';

import { type AppEnv, app } from './app';
import { handleScheduled, type RetentionEnv } from './jobs/retention';

type Env = AppEnv & RetentionEnv;

export default {
  fetch: app.fetch,
  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(handleScheduled(env));
  },
};
