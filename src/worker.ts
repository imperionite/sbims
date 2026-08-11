import type { ExecutionContext } from "hono";

import { initializeRuntime } from "./config/runtime.ts";

export default {
  async fetch(
    request: Request,
    env: Record<string, string>,
    ctx: ExecutionContext,
  ) {
    initializeRuntime(env);

    // After the first import, the JavaScript module is cached by the runtime,
    // so we are not rebuilding the application on every request

    const { app } = await import("./app.ts");

    return app.fetch(request, env, ctx);
  },
};
