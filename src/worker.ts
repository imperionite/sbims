import { ExecutionContext } from "hono";
import { createApp } from "./app.ts";
import { loadEnv, type RuntimeEnv } from "./config/env.ts";

type CloudflareEnv = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SECRET_KEY: string;

  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;

  ENVIRONMENT?: string;
  ALLOWED_ORIGINS?: string;
  FRONTEND_URL: string;

  RATE_LIMIT_ENABLED?: string;
  PORT?: string;
};

function getCloudflareEnv(env: CloudflareEnv): RuntimeEnv {
  return {
    SUPABASE_URL: env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: env.SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SECRET_KEY: env.SUPABASE_SECRET_KEY,

    UPSTASH_REDIS_REST_URL: env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: env.UPSTASH_REDIS_REST_TOKEN,

    ENVIRONMENT: env.ENVIRONMENT,
    ALLOWED_ORIGINS: env.ALLOWED_ORIGINS,
    FRONTEND_URL: env.FRONTEND_URL,

    RATE_LIMIT_ENABLED: env.RATE_LIMIT_ENABLED,
    PORT: env.PORT,
  };
}

export default {
  async fetch(
    request: Request,
    env: CloudflareEnv,
    executionContext: ExecutionContext,
  ): Promise<Response> {
    const config = loadEnv(getCloudflareEnv(env));
    const app = createApp(config);

    return await app.fetch(request, env, executionContext);
  },
};
