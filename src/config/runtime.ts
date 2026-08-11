import type { RuntimeEnv } from "./env.ts";

let runtimeEnv: RuntimeEnv | undefined;

export function initializeRuntime(env?: RuntimeEnv): void {
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
