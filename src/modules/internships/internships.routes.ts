import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

import type { AppVariables } from "../../types/context.ts";

import { requireAuth } from "../auth/auth.middleware.ts";
import { requireRole } from "../auth/role.middleware.ts";

import {
  createInternshipSchema,
  updateFacultyAdviserSchema,
  updateInternshipSchema,
  updateInternshipStatusSchema,
} from "./internships.schema.ts";

import { InternshipService } from "./internships.service.ts";

const internships = new Hono<{
  Variables: AppVariables;
}>();

/**
 * GET /internships
 *
 * Administrator and internship coordinator.
 */
internships.get(
  "/",
  requireAuth,
  requireRole("administrator", "internship_coordinator"),
  async (c) => {
    const internshipService = new InternshipService(c.get("supabase"));

    const result = await internshipService.listInternships();

    return c.json({
      success: true,
      data: result,
    });
  },
);

/**
 * GET /internships/me
 *
 * Student's own internship.
 *
 * Keep this route before /:id.
 */
internships.get("/me", requireAuth, requireRole("student"), async (c) => {
  const internshipService = new InternshipService(c.get("supabase"));

  const user = c.get("user");

  const result = await internshipService.getMyInternship(user.id);

  return c.json({
    success: true,
    data: result,
  });
});

/**
 * GET /internships/:id
 */
internships.get(
  "/:id",
  requireAuth,
  requireRole("administrator", "internship_coordinator"),
  async (c) => {
    const internshipService = new InternshipService(c.get("supabase"));

    const internshipId = c.req.param("id");

    if (!internshipId) {
      return c.json(
        {
          success: false,
          message: "Internship ID is required.",
        },
        400,
      );
    }

    const result = await internshipService.getInternship(internshipId);

    return c.json({
      success: true,
      data: result,
    });
  },
);

/**
 * POST /internships
 */
internships.post(
  "/",
  requireAuth,
  requireRole("administrator", "internship_coordinator"),
  zValidator("json", createInternshipSchema),
  async (c) => {
    const internshipService = new InternshipService(c.get("supabase"));

    const body = c.req.valid("json");

    const result = await internshipService.createInternship(body);

    return c.json(
      {
        success: true,
        data: result,
      },
      201,
    );
  },
);

/**
 * PATCH /internships/:id/status
 */
internships.patch(
  "/:id/status",
  requireAuth,
  requireRole("administrator", "internship_coordinator"),
  zValidator("json", updateInternshipStatusSchema),
  async (c) => {
    const internshipService = new InternshipService(c.get("supabase"));

    const body = c.req.valid("json");

    const result = await internshipService.updateStatus(
      c.req.param("id"),
      body.status,
    );

    return c.json({
      success: true,
      data: result,
    });
  },
);

/**
 * PATCH /internships/:id/adviser
 */
internships.patch(
  "/:id/adviser",
  requireAuth,
  requireRole("administrator", "internship_coordinator"),
  zValidator("json", updateFacultyAdviserSchema),
  async (c) => {
    const internshipService = new InternshipService(c.get("supabase"));

    const body = c.req.valid("json");

    const result = await internshipService.assignFacultyAdviser(
      c.req.param("id"),
      body.facultyAdviserId,
    );

    return c.json({
      success: true,
      data: result,
    });
  },
);

/**
 * PATCH /internships/:id
 */
internships.patch(
  "/:id",
  requireAuth,
  requireRole("administrator", "internship_coordinator"),
  zValidator("json", updateInternshipSchema),
  async (c) => {
    const internshipService = new InternshipService(c.get("supabase"));

    const body = c.req.valid("json");

    const result = await internshipService.updateInternship(
      c.req.param("id"),
      body,
    );

    return c.json({
      success: true,
      data: result,
    });
  },
);

export default internships;
