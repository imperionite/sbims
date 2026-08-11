let runtimeEnv: Record<string, string> | undefined;

/**
 * Initializes the runtime environment.
 *
 * Cloudflare Workers provide environment bindings through the
 * fetch() handler. Deno Deploy uses Deno.env.
 */
export function initializeRuntime(env?: Record<string, string>) {
  runtimeEnv = env;
}

/**
 * Returns an environment variable from the active runtime.
 *
 * Priority:
 * 1. Explicit runtime bindings (Cloudflare Workers)
 * 2. Deno environment variables (Deno Deploy / local development)
 */
export function getEnv(name: string): string | undefined {
  if (runtimeEnv) {
    return runtimeEnv[name];
  }

  if (typeof Deno !== "undefined") {
    return Deno.env.get(name);
  }

  return undefined;
}
