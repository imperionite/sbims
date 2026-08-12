import { z } from "zod";

export const createInternshipSchema = z.object({
  studentId: z.string().uuid(),
  hteId: z.string().uuid(),
  requiredHours: z.number().int().positive().nullable().optional(),
});

export const createMyInternshipSchema = z.object({
  hteId: z.string().uuid(),
});

export const updateInternshipStatusSchema = z.object({
  status: z.enum(["pending", "active", "completed"]),
});

export const updateFacultyAdviserSchema = z.object({
  facultyAdviserId: z.string().uuid().nullable(),
});

export const updateInternshipSchema = z
  .object({
    hteId: z.string().uuid().optional(),
    requiredHours: z.number().int().positive().optional(),
  })
  .refine(
    (data) => data.hteId !== undefined || data.requiredHours !== undefined,
    {
      message: "At least one internship field must be provided.",
    },
  );
