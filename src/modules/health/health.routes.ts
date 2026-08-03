import { Hono } from "hono";

import { checkDatabase } from "./health.service.ts";

import { failure, success } from "../../shared/response.ts";

const health = new Hono();

health.get("/", async (c) => {
  const start = performance.now();

  const healthy = await checkDatabase();

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
