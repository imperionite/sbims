let runtimeEnv: Record<string, string> | undefined;

export function initializeRuntime(env?: Record<string, string>) {
  runtimeEnv = env;
}

export function getEnv(name: string): string | undefined {
  if (runtimeEnv) {
    return runtimeEnv[name];
  }

  if (typeof Deno !== "undefined") {
    return Deno.env.get(name);
  }

  return undefined;
}
