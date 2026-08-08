import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

import { requireAuth } from "../auth/auth.middleware.ts";
import { requireRole } from "../auth/role.middleware.ts";

import {
  createStudentSchema,
  updateMyStudentSchema,
  updateStudentSchema,
} from "./students.schema.ts";

import { studentService } from "./students.service.ts";

const students = new Hono<{
  Variables: {
    user: {
      id: string;
      email?: string;
    };
  };
}>();

/**
 * -------------------------------------------------------
 * GET /students
 * -------------------------------------------------------
 *
 * Administrator and internship coordinator only.
 */
students.get(
  "/",
  requireAuth,
  requireRole("administrator", "internship_coordinator"),
  async (c) => {
    const result = await studentService.listStudents();

    return c.json({
      success: true,
      data: result,
    });
  },
);

/**
 * -------------------------------------------------------
 * GET /students/me
 * -------------------------------------------------------
 *
 * Student can view their own student profile.
 *
 * This route is intentionally declared before /:id.
 */
students.get("/me", requireAuth, requireRole("student"), async (c) => {
  const user = c.get("user");

  const result = await studentService.getMyStudentProfile(user.id);

  return c.json({
    success: true,
    data: result,
  });
});

/**
 * -------------------------------------------------------
 * PATCH /students/me
 * -------------------------------------------------------
 *
 * Student can update their own personal/contact data.
 *
 * Students cannot change:
 * - student number
 * - program
 * - year level
 * - internship status
 */
students.patch(
  "/me",
  requireAuth,
  requireRole("student"),
  zValidator("json", updateMyStudentSchema),
  async (c) => {
    const user = c.get("user");
    const body = c.req.valid("json");

    const result = await studentService.updateMyStudentProfile(user.id, body);

    return c.json({
      success: true,
      data: result,
    });
  },
);

/**
 * -------------------------------------------------------
 * GET /students/:id
 * -------------------------------------------------------
 *
 * Administrator, internship coordinator, and faculty
 * adviser may access this endpoint at the API layer.
 *
 * Faculty adviser access is intentionally limited here
 * until adviser/student assignment is implemented.
 */
students.get(
  "/:id",
  requireAuth,
  requireRole("administrator", "internship_coordinator", "faculty_adviser"),
  async (c) => {
    const id = c.req.param("id");

    if (!id) {
      return c.json(
        {
          success: false,
          message: "Student ID is required.",
        },
        400,
      );
    }

    const result = await studentService.getStudent(id);

    return c.json({
      success: true,
      data: result,
    });
  },
);

/**
 * -------------------------------------------------------
 * POST /students
 * -------------------------------------------------------
 *
 * Administrator and internship coordinator create a
 * student profile for an EXISTING student user.
 */
students.post(
  "/",
  requireAuth,
  requireRole("administrator", "internship_coordinator"),
  zValidator("json", createStudentSchema),
  async (c) => {
    const body = c.req.valid("json");

    const result = await studentService.createStudent(body);

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
 * -------------------------------------------------------
 * PATCH /students/:id
 * -------------------------------------------------------
 *
 * Administrator and internship coordinator may update
 * the complete student internship profile.
 */
students.patch(
  "/:id",
  requireAuth,
  requireRole("administrator", "internship_coordinator"),
  zValidator("json", updateStudentSchema),
  async (c) => {
    const body = c.req.valid("json");

    const result = await studentService.updateStudent(c.req.param("id"), body);

    return c.json({
      success: true,
      data: result,
    });
  },
);

export default students;
