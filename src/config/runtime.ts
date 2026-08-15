import type { RuntimeEnv } from "./env.ts";

/**
 * Runtime environment abstraction.
 *
 * The application should receive environment values explicitly
 * rather than reading from a specific runtime such as Deno.
 */
export type { RuntimeEnv };

/**
 * Reads environment variables from the Deno runtime.
 *
 * This function belongs at the Deno runtime boundary.
 * Cloudflare Workers should provide their environment through
 * Worker bindings instead.
 */
export function getDenoEnv(): RuntimeEnv {
  const env: RuntimeEnv = {};

  const envObject = Deno.env.toObject();
  for (const key in envObject) {
    env[key] = envObject[key];
  }

  return env;
}
