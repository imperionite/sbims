import type { ExecutionContext } from "hono";

import { initializeRuntime } from "./config/runtime.ts";

export default {
  async fetch(
    request: Request,
    env: Record<string, string>,
    ctx: ExecutionContext,
  ) {
    initializeRuntime(env);

    const { app } = await import("./app.ts");

    return app.fetch(request, env, ctx);
  },
};
