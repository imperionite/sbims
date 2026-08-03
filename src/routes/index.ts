import { Hono } from "hono";

import health from "../modules/health/health.routes.ts";
import auth from "../modules/auth/auth.routes.ts";

const api = new Hono();

api.route(
  "/health",
  health,
);

api.route(
  "/auth",
  auth,
);

export default api;
