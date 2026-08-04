import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email(),

  password: z.string().min(8).max(72),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const changePasswordSchema = z.object({
  newPassword: z.string().min(8).max(72),
});

export type LoginRequest = z.infer<typeof loginSchema>;

export type RefreshTokenRequest = z.infer<typeof refreshTokenSchema>;

export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>;
