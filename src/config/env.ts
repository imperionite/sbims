import { z } from "zod";
import { getEnv } from "./runtime.ts";

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),

  SUPABASE_ANON_KEY: z.string().min(1),

  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  PORT: z.coerce.number().default(8000),

  ENVIRONMENT: z
    .enum(["development", "production", "test"])
    .default("development"),

  ALLOWED_ORIGINS: z.string().default("http://localhost:5173"),

  FRONTEND_URL: z.string().url(),

  RATE_LIMIT_ENABLED: z.coerce.boolean().default(true),
});

export type AppConfig =
  & Omit<
    z.infer<typeof envSchema>,
    "ALLOWED_ORIGINS"
  >
  & {
    ALLOWED_ORIGINS: string[];
  };

export type RuntimeEnv = Record<string, string | undefined>;

export function loadEnv(source?: RuntimeEnv): AppConfig {
  const get = (name: string): string | undefined => {
    if (source && source[name] !== undefined) {
      return source[name];
    }

    return getEnv(name);
  };

  const parsed = envSchema.parse({
    SUPABASE_URL: get("SUPABASE_URL"),

    SUPABASE_ANON_KEY: get("SUPABASE_PUBLISHABLE_KEY"),

    SUPABASE_SERVICE_ROLE_KEY: get("SUPABASE_SECRET_KEY"),

    PORT: get("PORT"),

    ENVIRONMENT: get("ENVIRONMENT"),

    ALLOWED_ORIGINS: get("ALLOWED_ORIGINS"),

    FRONTEND_URL: get("FRONTEND_URL"),

    RATE_LIMIT_ENABLED: get("RATE_LIMIT_ENABLED") !== "false",
  });

  return {
    ...parsed,

    ALLOWED_ORIGINS: parsed.ALLOWED_ORIGINS
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  };
}
