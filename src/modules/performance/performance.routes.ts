import { Hono } from "hono";

import { performWork } from "./performance.service.ts";

const DEFAULT_WORK = 1000;
const MAX_WORK = 10_000;

export const performanceRoutes = new Hono();

performanceRoutes.get("/ping", (c) => {
  return c.json({
    success: true,
    message: "Performance endpoint available",
    data: {
      timestamp: new Date().toISOString(),
    },
  });
});

performanceRoutes.get("/compute", (c) => {
  const rawWork = c.req.query("work");

  const work = rawWork === undefined ? DEFAULT_WORK : Number(rawWork);

  if (!Number.isInteger(work) || work < 1 || work > MAX_WORK) {
    return c.json(
      {
        success: false,
        message: `work must be an integer between 1 and ${MAX_WORK}.`,
      },
      400,
    );
  }

  const result = performWork(work);

  return c.json({
    success: true,
    message: "Performance computation completed",
    data: {
      work,
      result,
      timestamp: new Date().toISOString(),
    },
  });
});
