import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honologger } from "hono/logger";
import { env } from "./config/env.ts";
import { logger as appLogger } from "./shared/logger.ts";

import api from "./routes/index.ts";

import { AppError } from "./errors/app-error.ts";

import { failure } from "./shared/response.ts";

export const app = new Hono();

app.use("*", honologger());

app.use(
  "*",
  cors({
    origin: env.ALLOWED_ORIGINS,

    credentials: true,
  }),
);

app.route("/api/v1", api);

app.notFound((c) => {
  return c.json(
    failure("Endpoint not found", [
      {
        path: c.req.path,
      },
    ]),
    404,
  );
});

app.onError((error, c) => {
  if (error instanceof AppError) {
    return c.json(failure(error.message), error.status);
  }

  appLogger.error("Unhandled application error", error);

  return c.json(failure("Internal server error"), 500);
});
