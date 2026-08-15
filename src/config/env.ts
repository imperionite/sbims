import { z } from "zod";

// Lightweight RuntimeEnv type to avoid circular type-only import
export type RuntimeEnv = Record<string, string | undefined>;

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),

  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),

  SUPABASE_SECRET_KEY: z.string().min(1),

  PORT: z.coerce.number().default(8000),

  UPSTASH_REDIS_REST_URL: z.string().url(),

  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),

  ENVIRONMENT: z
    .enum(["development", "production", "test"])
    .default("development"),

  ALLOWED_ORIGINS: z.string().default("http://localhost:5173"),

  FRONTEND_URL: z.string().url(),

  RATE_LIMIT_ENABLED: z.coerce.boolean().default(true),
});

export type AppConfig = Omit<z.infer<typeof envSchema>, "ALLOWED_ORIGINS"> & {
  ALLOWED_ORIGINS: string[];
};

export function loadEnv(source: RuntimeEnv): AppConfig {
  const get = (name: string): string | undefined => {
    return source[name];
  };

  const parsed = envSchema.parse({
    SUPABASE_URL: get("SUPABASE_URL"),

    SUPABASE_PUBLISHABLE_KEY: get("SUPABASE_PUBLISHABLE_KEY"),

    SUPABASE_SECRET_KEY: get("SUPABASE_SECRET_KEY"),

    UPSTASH_REDIS_REST_URL: get("UPSTASH_REDIS_REST_URL"),

    UPSTASH_REDIS_REST_TOKEN: get("UPSTASH_REDIS_REST_TOKEN"),

    PORT: get("PORT"),

    ENVIRONMENT: get("ENVIRONMENT"),

    ALLOWED_ORIGINS: get("ALLOWED_ORIGINS"),

    FRONTEND_URL: get("FRONTEND_URL"),

    RATE_LIMIT_ENABLED: get("RATE_LIMIT_ENABLED"),
  });

  const rateLimitEnabled = parsed.ENVIRONMENT !== "test" && parsed.RATE_LIMIT_ENABLED;

  return {
    ...parsed,

    ALLOWED_ORIGINS: parsed.ALLOWED_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),

    RATE_LIMIT_ENABLED: rateLimitEnabled,
  };
}
