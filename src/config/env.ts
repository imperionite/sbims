import { z } from "zod";

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

  RATE_LIMIT_ENABLED: z.boolean(),
});

const parsed = envSchema.parse({
  SUPABASE_URL: Deno.env.get("SUPABASE_URL"),

  SUPABASE_ANON_KEY: Deno.env.get("SUPABASE_PUBLISHABLE_KEY"),

  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SECRET_KEY"),

  PORT: Deno.env.get("PORT"),

  ENVIRONMENT: Deno.env.get("ENVIRONMENT"),

  ALLOWED_ORIGINS: Deno.env.get("ALLOWED_ORIGINS"),

  FRONTEND_URL: Deno.env.get("FRONTEND_URL"),

  RATE_LIMIT_ENABLED: Deno.env.get("RATE_LIMIT_ENABLED") !== "false",
});

export const env = {
  ...parsed,

  ALLOWED_ORIGINS: parsed.ALLOWED_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
} as const;
