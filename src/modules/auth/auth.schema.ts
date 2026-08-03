import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email(),

  password: z
    .string()
    .min(8)
    .max(72),
});

export const changePasswordSchema = z.object({
  newPassword: z
    .string()
    .min(8)
    .max(72),
});

export type LoginRequest = z.infer<typeof loginSchema>;

export type ChangePasswordRequest = z.infer<
  typeof changePasswordSchema
>;
