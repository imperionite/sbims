import { assertEquals, assertRejects } from "@std/assert";

import { stub } from "@std/testing/mock";

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

Deno.test("AuthService should map profile correctly", async () => {
  const service = new AuthService();

  const result =
    // @ts-ignore testing private method
    service.mapProfile(mockProfile);

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

Deno.test("AuthService should reject missing profile", async () => {
  const service = new AuthService();

  await assertRejects(
    async () => {
      // @ts-ignore accessing private method
      await service.getProfile("missing-user");
    },

    AppError,
  );
});
