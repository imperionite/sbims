import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

import { AppError } from "../../errors/app-error.ts";
import { requireAuth } from "../auth/auth.middleware.ts";
import { requireRole } from "../auth/role.middleware.ts";
import type { AuthRole } from "../auth/auth.types.ts";

import {
  attendanceValidationSchema,
  createAttendanceSchema,
  updateAttendanceSchema,
} from "./attendance.schema.ts";

import { attendanceService } from "./attendance.service.ts";

type AttendanceUser = {
  id: string;
  email?: string;
};

type AttendanceVariables = {
  user: AttendanceUser;
  userRole: AuthRole;
};

const attendance = new Hono<{
  Variables: AttendanceVariables;
}>();

attendance.use("*", requireAuth);

/**
 * POST /attendance
 *
 * Student creates attendance for their own
 * active internship.
 */
attendance.post(
  "/",
  requireRole("student"),
  zValidator("json", createAttendanceSchema),
  async (c) => {
    const user = c.get("user");

    const body = c.req.valid("json");

    const result = await attendanceService.createAttendance(
      user.id,
      body,
    );

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
 * GET /attendance/me
 *
 * Student retrieves their own attendance.
 */
attendance.get(
  "/me",
  requireRole("student"),
  async (c) => {
    const user = c.get("user");

    const result = await attendanceService.getMyAttendance(
      user.id,
    );

    return c.json({
      success: true,
      data: result,
    });
  },
);

/**
 * GET /attendance/internship/:internshipId
 *
 * Student or internship coordinator retrieves
 * attendance records for an internship.
 */
attendance.get(
  "/internship/:internshipId",
  requireRole(
    "student",
    "internship_coordinator",
  ),
  async (c) => {
    const internshipId = c.req.param("internshipId");

    if (!internshipId) {
      throw new AppError(
        400,
        "Internship ID is required.",
      );
    }

    const result = await attendanceService.getAttendanceByInternship(
      internshipId,
    );

    return c.json({
      success: true,
      data: result,
    });
  },
);

/**
 * GET /attendance/internship/:internshipId/rendered-hours
 *
 * Student or internship coordinator retrieves
 * total validated rendered hours.
 */
attendance.get(
  "/internship/:internshipId/rendered-hours",
  requireRole(
    "student",
    "internship_coordinator",
  ),
  async (c) => {
    const internshipId = c.req.param("internshipId");

    if (!internshipId) {
      throw new AppError(
        400,
        "Internship ID is required.",
      );
    }

    const totalHours = await attendanceService.getRenderedHours(
      internshipId,
    );

    return c.json({
      success: true,
      data: {
        internshipId,
        totalHours,
      },
    });
  },
);

/**
 * GET /attendance/:id
 *
 * Student or internship coordinator retrieves
 * an attendance record.
 */
attendance.get(
  "/:id",
  requireRole(
    "student",
    "internship_coordinator",
  ),
  async (c) => {
    const id = c.req.param("id");

    if (!id) {
      throw new AppError(
        400,
        "Attendance ID is required.",
      );
    }

    const result = await attendanceService.getAttendanceById(
      id,
    );

    return c.json({
      success: true,
      data: result,
    });
  },
);

/**
 * PATCH /attendance/:id
 *
 * Student may update their own attendance
 * while it is still pending.
 */
attendance.patch(
  "/:id",
  requireRole("student"),
  zValidator(
    "json",
    updateAttendanceSchema,
  ),
  async (c) => {
    const user = c.get("user");

    const id = c.req.param("id");

    if (!id) {
      throw new AppError(
        400,
        "Attendance ID is required.",
      );
    }

    const body = c.req.valid("json");

    const result = await attendanceService.updateAttendance(
      id,
      user.id,
      body,
    );

    return c.json({
      success: true,
      data: result,
    });
  },
);

/**
 * PATCH /attendance/:id/validation
 *
 * Only an internship coordinator can validate
 * or reject a pending attendance record.
 */
attendance.patch(
  "/:id/validation",
  requireRole(
    "internship_coordinator",
  ),
  zValidator(
    "json",
    attendanceValidationSchema,
  ),
  async (c) => {
    const user = c.get("user");

    const id = c.req.param("id");

    if (!id) {
      throw new AppError(
        400,
        "Attendance ID is required.",
      );
    }

    const body = c.req.valid("json");

    const result = await attendanceService.validateAttendance(
      id,
      user.id,
      body.validation_status,
    );

    return c.json({
      success: true,
      data: result,
    });
  },
);

export default attendance;
