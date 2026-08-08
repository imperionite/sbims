import { z } from "zod";

const internshipStatusSchema = z.enum(["pending", "active", "completed"]);

/**
 * FR-03
 *
 * Creates a student internship profile for an
 * existing application user.
 *
 * The userId must belong to a profile whose
 * role is "student".
 */
export const createStudentSchema = z.object({
  userId: z.string().uuid(),

  studentNumber: z.string().trim().min(1),

  program: z.string().trim().min(1),

  yearLevel: z.number().int().min(1).max(6),

  section: z.string().trim().nullable().optional(),

  contactNumber: z.string().trim().nullable().optional(),

  address: z.string().trim().nullable().optional(),

  emergencyContactName: z.string().trim().nullable().optional(),

  emergencyContactNumber: z.string().trim().nullable().optional(),
});

/**
 * Fields that staff may update on a student profile.
 */
export const updateStudentSchema = z.object({
  studentNumber: z.string().trim().min(1).optional(),

  program: z.string().trim().min(1).optional(),

  yearLevel: z.number().int().min(1).max(6).optional(),

  section: z.string().trim().nullable().optional(),

  contactNumber: z.string().trim().nullable().optional(),

  address: z.string().trim().nullable().optional(),

  emergencyContactName: z.string().trim().nullable().optional(),

  emergencyContactNumber: z.string().trim().nullable().optional(),

  internshipStatus: internshipStatusSchema.optional(),
});

/**
 * Fields a student may update for their own profile.
 *
 * Identity/academic fields and internship status are
 * intentionally excluded.
 */
export const updateMyStudentSchema = z.object({
  contactNumber: z.string().trim().nullable().optional(),

  address: z.string().trim().nullable().optional(),

  emergencyContactName: z.string().trim().nullable().optional(),

  emergencyContactNumber: z.string().trim().nullable().optional(),
});

export const studentSchema = z.object({
  id: z.string().uuid(),

  studentNumber: z.string(),

  program: z.string(),

  yearLevel: z.number(),

  section: z.string().nullable(),

  contactNumber: z.string().nullable(),

  address: z.string().nullable(),

  emergencyContactName: z.string().nullable(),

  emergencyContactNumber: z.string().nullable(),

  internshipStatus: internshipStatusSchema,

  createdAt: z.string(),

  updatedAt: z.string(),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;

export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;

export type UpdateMyStudentInput = z.infer<typeof updateMyStudentSchema>;

export type Student = z.infer<typeof studentSchema>;
