import { assertEquals, assertRejects } from "@std/assert";

import { AuthService } from "../../../src/modules/auth/auth.service.ts";
import { AppError } from "../../../src/errors/app-error.ts";

const mockProfile = {
  id: "user-123",
  email: "test@test.com",
  first_name: "John",
  middle_name: null,
  last_name: "Doe",
  suffix: null,
  role: "student",
  is_active: true,
  must_change_password: false,
};

function createMockSupabase() {
  const profileQuery = {
    select: () => profileQuery,
    eq: () => profileQuery,

    single: () =>
      Promise.resolve({
        data: mockProfile,
        error: null,
      }),

    maybeSingle: () =>
      Promise.resolve({
        data: mockProfile,
        error: null,
      }),
  };

  const supabaseAdmin = {
    from: (_table: string) => profileQuery,

    auth: {
      admin: {
        signOut: () => ({
          error: null,
        }),

        updateUserById: () => ({
          data: {
            user: {
              id: "user-123",
            },
          },
          error: null,
        }),
      },
    },
  };

  const supabaseClient = {
    auth: {
      signInWithPassword: () =>
        Promise.resolve({
          data: {
            user: {
              id: "user-123",
            },
            session: {
              access_token: "access-token",
              refresh_token: "refresh-token",
            },
          },
          error: null,
        }),

      refreshSession: () =>
        Promise.resolve({
          data: {
            session: {
              access_token: "access-token",
              refresh_token: "refresh-token",
              user: {
                id: "user-123",
              },
            },
          },
          error: null,
        }),

      resetPasswordForEmail: () => ({
        error: null,
      }),
    },
  };

  return {
    supabaseClient,
    supabaseAdmin,
    createAuthenticatedClient: () => supabaseClient,
    createPublicClient: () => supabaseClient,
    // deno-lint-ignore no-explicit-any
  } as any;
}

function createAuthService() {
  return new AuthService(createMockSupabase(), "http://localhost:3000");
}

/*
 * ---------------------------------------------------------
 * GET CURRENT USER / PROFILE MAPPING
 * ---------------------------------------------------------
 */

Deno.test("AuthService should map profile correctly", async () => {
  const service = createAuthService();

  const result = await service.getCurrentUser("user-123");

  assertEquals(result, {
    id: "user-123",
    email: "test@test.com",
    firstName: "John",
    middleName: null,
    lastName: "Doe",
    suffix: null,
    role: "student",
    mustChangePassword: false,
  });
});

/*
 * ---------------------------------------------------------
 * MISSING PROFILE
 * ---------------------------------------------------------
 */

Deno.test("AuthService should reject missing profile", async () => {
  const supabase = createMockSupabase();

  const missingProfileQuery = {
    select: () => missingProfileQuery,
    eq: () => missingProfileQuery,

    single: () => ({
      data: null,
      error: {
        message: "Profile not found",
      },
    }),

    maybeSingle: () => ({
      data: null,
      error: {
        message: "Profile not found",
      },
    }),
  };

  supabase.supabaseAdmin.from = (_table: string) => missingProfileQuery;

  const service = new AuthService(supabase, "http://localhost:3000");

  await assertRejects(
    () => service.getCurrentUser("missing-user"),
    AppError,
    "Profile not found.",
  );
});
