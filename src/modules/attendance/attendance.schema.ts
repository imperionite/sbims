import { z } from "zod";

export const createAttendanceSchema = z.object({
  internship_id: z.string().uuid(),

  attendance_date: z.string().date(),

  time_in: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Invalid time format."),

  time_out: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Invalid time format."),
});

export const updateAttendanceSchema = z
  .object({
    attendance_date: z.string().date().optional(),

    time_in: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Invalid time format.")
      .optional(),

    time_out: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Invalid time format.")
      .optional(),
  })
  .refine(
    (data) =>
      data.attendance_date !== undefined ||
      data.time_in !== undefined ||
      data.time_out !== undefined,
    {
      message: "At least one attendance field must be provided.",
    },
  );

export const attendanceValidationSchema = z.object({
  validation_status: z.enum(["validated", "rejected"]),
});

export type CreateAttendanceRequest = z.infer<typeof createAttendanceSchema>;

export type UpdateAttendanceRequest = z.infer<typeof updateAttendanceSchema>;

export type AttendanceValidationRequest = z.infer<
  typeof attendanceValidationSchema
>;
