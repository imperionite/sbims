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

export function loadEnv() {
  const parsed = envSchema.parse({
    SUPABASE_URL: getEnv("SUPABASE_URL"),

    SUPABASE_ANON_KEY: getEnv("SUPABASE_PUBLISHABLE_KEY"),

    SUPABASE_SERVICE_ROLE_KEY: getEnv("SUPABASE_SECRET_KEY"),

    PORT: getEnv("PORT"),

    ENVIRONMENT: getEnv("ENVIRONMENT"),

    ALLOWED_ORIGINS: getEnv("ALLOWED_ORIGINS"),

    FRONTEND_URL: getEnv("FRONTEND_URL"),

    RATE_LIMIT_ENABLED: getEnv("RATE_LIMIT_ENABLED") !== "false",
  });

  return {
    ...parsed,

    ALLOWED_ORIGINS: parsed.ALLOWED_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  } as const;
}
