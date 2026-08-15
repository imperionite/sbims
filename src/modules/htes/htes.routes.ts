import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

import type { AppVariables } from "../../types/context.ts";

import { requireAuth } from "../auth/auth.middleware.ts";
import { requireRole } from "../auth/role.middleware.ts";

import {
  createHTESchema,
  updateHTESchema,
  updateHTEStatusSchema,
  updateHTESupervisorSchema,
} from "./htes.schema.ts";

import { HteService } from "./htes.service.ts";

const htes = new Hono<{
  Variables: AppVariables;
}>();

htes.use(
  "*",
  requireAuth,
  requireRole("administrator", "internship_coordinator"),
);

/**
 * GET /htes
 *
 * Administrator and internship coordinator only.
 */
htes.get("/", async (c) => {
  const hteService = new HteService(c.get("supabase"));

  const result = await hteService.listHtes();

  return c.json({
    success: true,
    data: result,
  });
});

/**
 * GET /htes/:id
 */
htes.get("/:id", async (c) => {
  const hteService = new HteService(c.get("supabase"));

  const result = await hteService.getHte(c.req.param("id"));

  return c.json({
    success: true,
    data: result,
  });
});

/**
 * POST /htes
 */
htes.post("/", zValidator("json", createHTESchema), async (c) => {
  const hteService = new HteService(c.get("supabase"));

  const body = c.req.valid("json");

  const result = await hteService.createHte(body);

  return c.json(
    {
      success: true,
      data: result,
    },
    201,
  );
});

/**
 * PATCH /htes/:id
 */
htes.patch("/:id", zValidator("json", updateHTESchema), async (c) => {
  const hteService = new HteService(c.get("supabase"));

  const body = c.req.valid("json");

  const result = await hteService.updateHte(c.req.param("id"), body);

  return c.json({
    success: true,
    data: result,
  });
});

/**
 * PATCH /htes/:id/status
 */
htes.patch(
  "/:id/status",
  zValidator("json", updateHTEStatusSchema),
  async (c) => {
    const hteService = new HteService(c.get("supabase"));

    const body = c.req.valid("json");

    const result = await hteService.updateStatus(c.req.param("id"), body);

    return c.json({
      success: true,
      data: result,
    });
  },
);

/**
 * PATCH /htes/:id/supervisor
 */
htes.patch(
  "/:id/supervisor",
  zValidator("json", updateHTESupervisorSchema),
  async (c) => {
    const hteService = new HteService(c.get("supabase"));

    const body = c.req.valid("json");

    const result = await hteService.assignSupervisor(
      c.req.param("id"),
      body.supervisorId,
    );

    return c.json({
      success: true,
      data: result,
    });
  },
);

export default htes;
