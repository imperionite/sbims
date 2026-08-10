import { loadEnv } from "../../config/env.ts";
import { supabaseAdmin, supabaseClient } from "../../lib/supabase.ts";

import { AppError } from "../../errors/app-error.ts";

import type {
  ChangePasswordRequest,
  CompletePasswordResetRequest,
  ForgotPasswordRequest,
  LoginRequest,
  RefreshTokenRequest,
} from "./auth.schema.ts";

import type { AuthUser, LoginResponse, Profile, TokenResponse } from "./auth.types.ts";

import { logger } from "../../shared/logger.ts";

const SUCCESS_MESSAGE = "If the email is registered, a password reset link has been sent.";

const env = loadEnv();

export class AuthService {
  async login(request: LoginRequest): Promise<LoginResponse> {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: request.email,
      password: request.password,
    });

    if (error || !data.user || !data.session) {
      throw new AppError(401, "Invalid credentials.");
    }

    // Check the application's profile status after Supabase
    // authentication succeeds.
    const profile = await this.getProfile(data.user.id);

    if (!profile.is_active) {
      // Revoke the newly authenticated user's sessions before
      // rejecting the login.
      const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(
        data.user.id,
        "global",
      );

      if (signOutError) {
        logger.warn("Unable to revoke inactive user's sessions", {
          userId: data.user.id,
          error: signOutError,
        });
      }

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
      ...this.mapTokens(data.session),
      user: this.mapProfile(profile),
    };
  }

  async refresh(request: RefreshTokenRequest): Promise<TokenResponse> {
    const session = await this.refreshSession(request.refreshToken);

    // Re-check the profile status after refreshing the session.
    const profile = await this.getProfile(session.user.id);

    if (!profile.is_active) {
      const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(
        session.user.id,
        "global",
      );

      if (signOutError) {
        logger.warn("Unable to revoke inactive user's sessions", {
          userId: session.user.id,
          error: signOutError,
        });
      }

      throw new AppError(403, "Account disabled.");
    }

    return this.mapTokens(session);
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

    const user = await this.getCurrentUser(userId);

    return {
      message: "Password changed successfully.",
      user,
    };
  }

  async forgotPassword(request: ForgotPasswordRequest) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, must_change_password")
      .eq("email", request.email.toLowerCase())
      .maybeSingle();

    // Prevent email enumeration.
    // If no profile exists, return silently.
    if (!profile) {
      return {
        message: SUCCESS_MESSAGE,
      };
    }

    if (profile.must_change_password) {
      throw new AppError(
        400,
        "Please sign in using your temporary password before using Forgot Password.",
      );
    }

    const { error } = await supabaseClient.auth.resetPasswordForEmail(
      request.email,
      {
        redirectTo: `${env.FRONTEND_URL}/reset-password`,
      },
    );

    if (error) {
      logger.error("Unable to initiate password recovery.", error);

      throw new AppError(500, "Unable to process password reset request.");
    }

    return {
      message: SUCCESS_MESSAGE,
    };
  }

  async completePasswordReset(request: CompletePasswordResetRequest) {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        must_change_password: false,
      })
      .eq("id", request.userId);

    if (error) {
      throw new AppError(500, error.message);
    }

    const user = await this.getCurrentUser(request.userId);

    return {
      message: "Password reset completed.",
      user,
    };
  }

  private async refreshSession(refreshToken: string) {
    const { data, error } = await supabaseClient.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session) {
      throw new AppError(401, "Invalid refresh token.");
    }

    return data.session;
  }

  private mapTokens(session: {
    access_token: string;
    refresh_token: string;
  }): TokenResponse {
    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
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
