import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

import type { AppVariables } from "../../types/context.ts";

import { requireAuth } from "../auth/auth.middleware.ts";
import { requireRole } from "../auth/role.middleware.ts";

import {
  createStudentSchema,
  updateMyStudentSchema,
  updateStudentSchema,
} from "./students.schema.ts";

import { StudentService } from "./students.service.ts";

const students = new Hono<{
  Variables: AppVariables;
}>();

/**
 * GET /students
 *
 * Administrator and internship coordinator only.
 */
students.get(
  "/",
  requireAuth,
  requireRole("administrator", "internship_coordinator"),
  async (c) => {
    const studentService = new StudentService(c.get("supabase"));

    const result = await studentService.listStudents();

    return c.json({
      success: true,
      data: result,
    });
  },
);

/**
 * GET /students/me
 *
 * Student can view their own student profile.
 *
 * Keep this route before /:id.
 */
students.get("/me", requireAuth, requireRole("student"), async (c) => {
  const studentService = new StudentService(c.get("supabase"));

  const user = c.get("user");

  const result = await studentService.getMyStudentProfile(user.id);

  return c.json({
    success: true,
    data: result,
  });
});

/**
 * PATCH /students/me
 *
 * Student can update their own personal/contact data.
 */
students.patch(
  "/me",
  requireAuth,
  requireRole("student"),
  zValidator("json", updateMyStudentSchema),
  async (c) => {
    const studentService = new StudentService(c.get("supabase"));

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
 * GET /students/:id
 *
 * Administrator, internship coordinator,
 * and faculty adviser.
 */
students.get(
  "/:id",
  requireAuth,
  requireRole("administrator", "internship_coordinator", "faculty_adviser"),
  async (c) => {
    const studentService = new StudentService(c.get("supabase"));

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
 * POST /students
 *
 * Administrator and internship coordinator
 * create a student profile for an existing
 * student user.
 */
students.post(
  "/",
  requireAuth,
  requireRole("administrator", "internship_coordinator"),
  zValidator("json", createStudentSchema),
  async (c) => {
    const studentService = new StudentService(c.get("supabase"));

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
 * PATCH /students/:id
 *
 * Administrator and internship coordinator
 * may update the complete student profile.
 */
students.patch(
  "/:id",
  requireAuth,
  requireRole("administrator", "internship_coordinator"),
  zValidator("json", updateStudentSchema),
  async (c) => {
    const studentService = new StudentService(c.get("supabase"));

    const body = c.req.valid("json");

    const result = await studentService.updateStudent(c.req.param("id"), body);

    return c.json({
      success: true,
      data: result,
    });
  },
);

export default students;
