import { Hono } from "hono";

import health from "../modules/health/health.routes.ts";
import auth from "../modules/auth/auth.routes.ts";
import users from "../modules/users/users.routes.ts";

const api = new Hono();

api.route(
  "/health",
  health,
);

api.route(
  "/auth",
  auth,
);

api.route(
  "/users",
  users,
);

export default api;
