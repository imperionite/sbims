import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

import type { AppVariables } from "../../types/context.ts";
import { AppError } from "../../errors/app-error.ts";

import { requireAuth } from "../auth/auth.middleware.ts";
import { requireRole } from "../auth/role.middleware.ts";

import { createEvaluationSchema, updateEvaluationSchema } from "./evaluations.schema.ts";

import { EvaluationService } from "./evaluations.service.ts";

const evaluations = new Hono<{
  Variables: AppVariables;
}>();

evaluations.use("*", requireAuth);

/**
 * POST /evaluations
 *
 * HTE Supervisor creates an evaluation for
 * a student intern assigned to their HTE.
 */
evaluations.post(
  "/",
  requireRole("hte_supervisor"),
  zValidator("json", createEvaluationSchema),
  async (c) => {
    const evaluationService = new EvaluationService(c.get("supabase"));

    const user = c.get("user");
    const body = c.req.valid("json");

    const result = await evaluationService.createEvaluation(user.id, body);

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
 * GET /evaluations/me
 *
 * HTE Supervisor retrieves evaluations associated
 * with their assigned HTE internships.
 */
evaluations.get("/me", requireRole("hte_supervisor"), async (c) => {
  const evaluationService = new EvaluationService(c.get("supabase"));

  const user = c.get("user");

  const result = await evaluationService.getMyEvaluations(user.id);

  return c.json({
    success: true,
    data: result,
  });
});

/**
 * GET /evaluations/internship/:internshipId
 *
 * Retrieves evaluations for an internship.
 *
 * HTE Supervisor:
 *   Must be the supervisor assigned to the internship's HTE.
 *
 * Student:
 *   Must own the internship and evaluations must be submitted.
 *
 * Internship Coordinator:
 *   Can access evaluations as part of internship management.
 */
evaluations.get(
  "/internship/:internshipId",
  requireRole("hte_supervisor", "student", "internship_coordinator"),
  async (c) => {
    const evaluationService = new EvaluationService(c.get("supabase"));

    const user = c.get("user");
    const role = c.get("userRole");

    const internshipId = c.req.param("internshipId");

    if (!internshipId) {
      throw new AppError(400, "Internship ID is required.");
    }

    if (
      role !== "hte_supervisor" &&
      role !== "student" &&
      role !== "internship_coordinator"
    ) {
      throw new AppError(403, "You are not authorized to access evaluations.");
    }

    const result = await evaluationService.getEvaluationsByInternship(
      internshipId,
      user.id,
      role,
    );

    return c.json({
      success: true,
      data: result,
    });
  },
);

/**
 * GET /evaluations/:id
 *
 * HTE Supervisor, student, or internship coordinator
 * retrieves a specific evaluation according to
 * the service-level authorization rules.
 */
evaluations.get(
  "/:id",
  requireRole("hte_supervisor", "student", "internship_coordinator"),
  async (c) => {
    const evaluationService = new EvaluationService(c.get("supabase"));

    const user = c.get("user");
    const role = c.get("userRole");

    const id = c.req.param("id");

    if (!id) {
      throw new AppError(400, "Evaluation ID is required.");
    }

    if (
      role !== "hte_supervisor" &&
      role !== "student" &&
      role !== "internship_coordinator"
    ) {
      throw new AppError(403, "You are not authorized to access evaluations.");
    }

    const result = await evaluationService.getEvaluationById(id, user.id, role);

    return c.json({
      success: true,
      data: result,
    });
  },
);

/**
 * PATCH /evaluations/:id
 *
 * HTE Supervisor updates their own draft evaluation.
 */
evaluations.patch(
  "/:id",
  requireRole("hte_supervisor"),
  zValidator("json", updateEvaluationSchema),
  async (c) => {
    const evaluationService = new EvaluationService(c.get("supabase"));

    const user = c.get("user");
    const id = c.req.param("id");

    if (!id) {
      throw new AppError(400, "Evaluation ID is required.");
    }

    const body = c.req.valid("json");

    const result = await evaluationService.updateEvaluation(id, user.id, body);

    return c.json({
      success: true,
      data: result,
    });
  },
);

/**
 * POST /evaluations/:id/submit
 *
 * HTE Supervisor submits their own draft evaluation.
 * Submission is final and cannot be edited afterward.
 */
evaluations.post("/:id/submit", requireRole("hte_supervisor"), async (c) => {
  const evaluationService = new EvaluationService(c.get("supabase"));

  const user = c.get("user");
  const id = c.req.param("id");

  if (!id) {
    throw new AppError(400, "Evaluation ID is required.");
  }

  const result = await evaluationService.submitEvaluation(id, user.id);

  return c.json({
    success: true,
    data: result,
  });
});

export default evaluations;
