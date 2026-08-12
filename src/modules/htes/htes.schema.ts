import { z } from "zod";

export const createHTESchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required"),

  address: z.string().trim().min(1, "Address is required"),

  contactPerson: z.string().trim().min(1, "Contact person is required"),

  contactEmail: z
    .string()
    .trim()
    .email("Invalid email address")
    .nullable()
    .optional(),

  contactNumber: z
    .string()
    .trim()
    .min(1, "Contact number cannot be empty")
    .nullable()
    .optional(),
});

export const updateHTESchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(1, "Company name cannot be empty")
    .optional(),

  address: z.string().trim().min(1, "Address cannot be empty").optional(),

  contactPerson: z
    .string()
    .trim()
    .min(1, "Contact person cannot be empty")
    .optional(),

  contactEmail: z
    .string()
    .trim()
    .email("Invalid email address")
    .nullable()
    .optional(),

  contactNumber: z
    .string()
    .trim()
    .min(1, "Contact number cannot be empty")
    .nullable()
    .optional(),
});

export const updateHTESupervisorSchema = z.object({
  supervisorId: z.string().uuid().nullable(),
});

export const updateHTEStatusSchema = z.object({
  isActive: z.boolean(),
});

export type UpdateHTESupervisorRequest = z.infer<
  typeof updateHTESupervisorSchema
>;
