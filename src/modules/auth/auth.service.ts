import { supabaseAdmin, supabaseClient } from "../../lib/supabase.ts";

import { AppError } from "../../errors/app-error.ts";

import type { ChangePasswordRequest, LoginRequest } from "./auth.schema.ts";

import type { AuthUser, LoginResponse, Profile } from "./auth.types.ts";

import { logger } from "../../shared/logger.ts";

export class AuthService {
  async login(request: LoginRequest): Promise<LoginResponse> {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: request.email,
      password: request.password,
    });

    if (error || !data.user || !data.session) {
      throw new AppError(401, "Invalid credentials.");
    }

    // getProfile throws AppError internally if not found or inactive,
    // so we just await it directly.
    const profile = await this.getProfile(data.user.id);

    if (!profile.is_active) {
      throw new AppError(403, "Account disabled.");
    }

    const { error: loginAuditError } = await supabaseAdmin
      .from("profiles")
      .update({
        last_login_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    if (loginAuditError) {
      logger.warn("Unable to update last login timestamp", {
        userId: profile.id,
        error: loginAuditError,
      });
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      requiresPasswordChange: profile.must_change_password,
      user: this.mapProfile(profile),
    };
  }

  async changePassword(userId: string, request: ChangePasswordRequest) {
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        password: request.newPassword,
      },
    );

    if (error || !data.user) {
      throw new AppError(400, error?.message ?? "Unable to update password.");
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        must_change_password: false,
      })
      .eq("id", userId);

    if (profileError) {
      throw new AppError(500, profileError.message);
    }

    return {
      message: "Password changed successfully.",
    };
  }

  private mapProfile(profile: Profile): AuthUser {
    return {
      id: profile.id,

      email: profile.email,

      firstName: profile.first_name,

      middleName: profile.middle_name,

      lastName: profile.last_name,

      suffix: profile.suffix,

      role: profile.role,

      mustChangePassword: profile.must_change_password,
    };
  }

  private async getProfile(userId: string): Promise<Profile> {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error || !data) {
      throw new AppError(404, "Profile not found.");
    }

    if (!data.is_active) {
      throw new AppError(403, "Account disabled.");
    }

    return data as Profile;
  }

  async getCurrentUser(userId: string) {
    const profile = await this.getProfile(userId);

    return this.mapProfile(profile);
  }
}

export const authService = new AuthService();
