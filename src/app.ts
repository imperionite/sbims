import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";

import type { AppConfig } from "./config/env.ts";
import { createSupabaseClients } from "./lib/supabase.ts";

import { createApiRoutes } from "./routes/index.ts";
import { createRateLimitStore } from "./infrastructure/rate-limit/create-rate-limit.store.ts";

import { AppError } from "./errors/app-error.ts";
import { failure } from "./shared/response.ts";
import { logger as appLogger } from "./shared/logger.ts";

import type { AppVariables } from "./types/context.ts";

export function createApp(env: AppConfig) {
  const app = new Hono<{
    Variables: AppVariables;
  }>();

  const supabase = createSupabaseClients(env);
  const rateLimitStore = createRateLimitStore(env);

  app.use("*", async (c, next) => {
    c.set("supabase", supabase);
    await next();
  });

  app.use("*", honoLogger());

  app.use(
    "*",
    cors({
      origin: env.ALLOWED_ORIGINS,
      credentials: true,
    }),
  );

  app.route("/api/v1", createApiRoutes(env.FRONTEND_URL, rateLimitStore));

  app.notFound((c) => {
    return c.json(
      failure("Endpoint not found", [
        {
          path: c.req.path,
        },
      ]),
      404,
    );
  });

  app.onError((error, c) => {
    if (error instanceof AppError) {
      return c.json(failure(error.message), error.status);
    }

    appLogger.error("Unhandled application error", error);

    return c.json(failure("Internal server error"), 500);
  });

  return app;
}
