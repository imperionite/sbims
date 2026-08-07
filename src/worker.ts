import { ExecutionContext } from "hono";
import { app } from "./app.ts";
import { initializeRuntime } from "./config/runtime.ts";

// Cloudflare Worker enry point for portability
export default {
  fetch(request: Request, env: Record<string, string>, ctx: ExecutionContext) {
    initializeRuntime(env);

    return app.fetch(request, env, ctx);
  },
};