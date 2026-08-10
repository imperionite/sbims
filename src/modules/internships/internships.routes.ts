import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

import { requireAuth } from "../auth/auth.middleware.ts";
import { requireRole } from "../auth/role.middleware.ts";

import { createInternshipSchema, updateInternshipStatusSchema } from "./internships.schema.ts";

import { internshipService } from "./internships.service.ts";

const internships = new Hono<{
  Variables: {
    user: {
      id: string;
      email?: string;
    };
  };
}>();

internships.get(
  "/",
  requireAuth,
  requireRole("administrator", "internship_coordinator"),
  async (c) => {
    const result = await internshipService.listInternships();

    return c.json({
      success: true,
      data: result,
    });
  },
);

internships.get("/me", requireAuth, requireRole("student"), async (c) => {
  const user = c.get("user");

  const result = await internshipService.getMyInternship(user.id);

  return c.json({
    success: true,
    data: result,
  });
});

internships.get(
  "/:id",
  requireAuth,
  requireRole("administrator", "internship_coordinator"),
  async (c) => {
    const internshipId = c.req.param("id");

    if (!internshipId) {
      return c.json(
        {
          success: false,
          error: "Internship ID is required",
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

internships.post(
  "/",
  requireAuth,
  requireRole("administrator", "internship_coordinator"),
  zValidator("json", createInternshipSchema),
  async (c) => {
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

internships.patch(
  "/:id/status",
  requireAuth,
  requireRole("administrator", "internship_coordinator"),
  zValidator("json", updateInternshipStatusSchema),
  async (c) => {
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

export default internships;
