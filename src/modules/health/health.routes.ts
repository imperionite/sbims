import { Hono } from "hono";

import { checkDatabase } from "./health.service.ts";

import { failure, success } from "../../shared/response.ts";

import type { AppVariables } from "../../types/context.ts";

const health = new Hono<{
  Variables: AppVariables;
}>();

health.get("/", async (c) => {
  const start = performance.now();

  const healthy = await checkDatabase(c.get("supabase"));

  const responseTimeMs = Math.round(performance.now() - start);

  const payload = {
    api: "running",
    database: healthy ? "connected" : "unreachable",
    responseTimeMs,
    timestamp: new Date().toISOString(),
  };

  if (!healthy) {
    return c.json(failure("Database unavailable", [payload]), 503);
  }

  return c.json(success(payload, "System healthy"));
});

export default health;
