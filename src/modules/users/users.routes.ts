import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

import type { AppVariables } from "../../types/context.ts";

import { requireAuth } from "../auth/auth.middleware.ts";
import { requireRole } from "../auth/role.middleware.ts";

import {
  createUserSchema,
  updateUserRoleSchema,
  updateUserSchema,
  updateUserStatusSchema,
} from "./users.schema.ts";

import { UserService } from "./users.service.ts";

const users = new Hono<{
  Variables: AppVariables;
}>();

users.use("*", requireAuth, requireRole("administrator"));

users.get("/", async (c) => {
  const userService = new UserService(c.get("supabase"));

  const result = await userService.listUsers();

  return c.json({
    success: true,
    data: result,
  });
});

users.get("/:id", async (c) => {
  const userService = new UserService(c.get("supabase"));

  const result = await userService.getUser(c.req.param("id"));

  return c.json({
    success: true,
    data: result,
  });
});

users.post("/", zValidator("json", createUserSchema), async (c) => {
  const userService = new UserService(c.get("supabase"));

  const body = c.req.valid("json");

  const result = await userService.createUser(body);

  return c.json(
    {
      success: true,
      data: result,
    },
    201,
  );
});

users.patch("/:id", zValidator("json", updateUserSchema), async (c) => {
  const userService = new UserService(c.get("supabase"));

  const body = c.req.valid("json");

  const result = await userService.updateUser(c.req.param("id"), body);

  return c.json({
    success: true,
    data: result,
  });
});

users.patch(
  "/:id/role",
  zValidator("json", updateUserRoleSchema),
  async (c) => {
    const userService = new UserService(c.get("supabase"));

    const body = c.req.valid("json");

    const result = await userService.updateUserRole(c.req.param("id"), body);

    return c.json({
      success: true,
      data: result,
    });
  },
);

users.patch(
  "/:id/status",
  zValidator("json", updateUserStatusSchema),
  async (c) => {
    const userService = new UserService(c.get("supabase"));

    const body = c.req.valid("json");

    const result = await userService.updateStatus(c.req.param("id"), body);

    return c.json({
      success: true,
      data: result,
    });
  },
);

export default users;
