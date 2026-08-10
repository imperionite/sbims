import { z } from "zod";

export const createInternshipSchema = z.object({
  studentId: z.string().uuid(),
  hteId: z.string().uuid(),
});

export const createMyInternshipSchema = z.object({
  hteId: z.string().uuid(),
});

export const updateInternshipStatusSchema = z.object({
  status: z.enum(["pending", "active", "completed"]),
});
