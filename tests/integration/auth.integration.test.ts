import { assertEquals } from "@std/assert";

import { app } from "../../src/app.ts";

import { setupTestUsers } from "../helpers/test-user.setup.ts";

import { TEST_USERS } from "../fixtures/test-users.ts";

async function login(
  email: string = TEST_USERS.admin.email,
  password: string = TEST_USERS.admin.password,
) {
  const response = await app.request("/api/v1/auth/login", {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      email,
      password,
    }),
  });

  const body = await response.json();

  return {
    response,
    body,
  };
}

Deno.test("FR-01 Login should authenticate user", async () => {
  await setupTestUsers();

  const { response, body } = await login();

  assertEquals(response.status, 200);

  assertEquals(body.success, true);

  if (!body.data.accessToken) {
    throw new Error("Missing access token");
  }
});

Deno.test("FR-01 Invalid password should reject login", async () => {
  await setupTestUsers();

  const { response } = await login(TEST_USERS.admin.email, "wrong-password");

  assertEquals(response.status, 401);
});

Deno.test("FR-01 /auth/me should return authenticated user", async () => {
  await setupTestUsers();

  const { body } = await login();

  const response = await app.request("/api/v1/auth/me", {
    method: "GET",

    headers: {
      Authorization: `Bearer ${body.data.accessToken}`,
    },
  });

  const result = await response.json();

  assertEquals(response.status, 200);

  assertEquals(result.data.email, TEST_USERS.admin.email);
});

Deno.test("FR-01 /auth/me without token should fail", async () => {
  const response = await app.request("/api/v1/auth/me");

  assertEquals(response.status, 401);
});

Deno.test("FR-01 logout endpoint should succeed", async () => {
  await setupTestUsers();

  const { body } = await login();

  const response = await app.request("/api/v1/auth/logout", {
    method: "POST",

    headers: {
      Authorization: `Bearer ${body.data.accessToken}`,
    },
  });

  const result = await response.json();

  assertEquals(response.status, 200);

  assertEquals(result.success, true);
});

Deno.test("FR-01 first login should require password change", async () => {
  await setupTestUsers();

  const { response, body } = await login(
    TEST_USERS.firstLogin.email,
    TEST_USERS.firstLogin.password,
  );

  assertEquals(response.status, 200);

  assertEquals(body.data.requiresPasswordChange, true);
});

Deno.test("FR-01 password change should clear first login state", async () => {
  await setupTestUsers();

  const { body } = await login(
    TEST_USERS.firstLogin.email,
    TEST_USERS.firstLogin.password,
  );

  const oldToken = body.data.accessToken;

  const changeResponse = await app.request("/api/v1/auth/change-password", {
    method: "POST",

    headers: {
      Authorization: `Bearer ${oldToken}`,

      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      newPassword: "NewTestPassword2026!",
    }),
  });

  assertEquals(changeResponse.status, 200);

  /*
       Password change invalidates the previous
       Supabase session.

       Login again using the new password
       to obtain a fresh access token.
    */

  const newLogin = await app.request("/api/v1/auth/login", {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      email: TEST_USERS.firstLogin.email,

      password: "NewTestPassword2026!",
    }),
  });

  const newLoginBody = await newLogin.json();

  assertEquals(newLogin.status, 200);

  const newToken = newLoginBody.data.accessToken;

  const meResponse = await app.request("/api/v1/auth/me", {
    headers: {
      Authorization: `Bearer ${newToken}`,
    },
  });

  const meBody = await meResponse.json();

  assertEquals(meResponse.status, 200);

  assertEquals(meBody.data.mustChangePassword, false);
});
