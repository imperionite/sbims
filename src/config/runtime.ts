let runtimeEnv: Record<string, string> | undefined;

export function initializeRuntime(env?: Record<string, string>) {
  runtimeEnv = env;
}

export function getEnv(name: string): string | undefined {
  if (runtimeEnv && runtimeEnv[name] !== undefined) {
    return runtimeEnv[name];
  }

  if (typeof Deno !== "undefined" && Deno.env) {
    return Deno.env.get(name);
  }

  return undefined;
}
