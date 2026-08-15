import { assertEquals, assertExists } from "@std/assert";

import { createApp } from "../../src/app.ts";

import { setupTestUsers } from "../helpers/test-user.setup.ts";
import { TEST_USERS } from "../fixtures/test-users.ts";

import { loadEnv } from "../../src/config/env.ts";
import { getDenoEnv } from "../../src/config/runtime.ts";

/*
 * Integration-test environment.
 *
 * Rate limiting must be disabled for these tests because several tests
 * intentionally authenticate repeatedly using the same accounts.
 *
 * In particular, the password-change test performs:
 *
 *   1. first login
 *   2. password change
 *   3. second login
 *   4. /auth/me
 *
 * These requests should test authentication behavior, not rate limiting.
 */
const env = loadEnv({
  ...getDenoEnv(),
  RATE_LIMIT_ENABLED: "false",
});

const app = createApp(env);

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

  assertExists(body.data);
  assertExists(body.data.accessToken);
});

Deno.test("FR-01 Invalid password should reject login", async () => {
  await setupTestUsers();

  const { response } = await login(TEST_USERS.admin.email, "wrong-password");

  assertEquals(response.status, 401);
});

Deno.test("FR-01 /auth/me should return authenticated user", async () => {
  await setupTestUsers();

  const { response: loginResponse, body: loginBody } = await login();

  assertEquals(
    loginResponse.status,
    200,
    `Login failed: ${JSON.stringify(loginBody)}`,
  );

  assertExists(loginBody.data);
  assertExists(loginBody.data.accessToken);

  const response = await app.request("/api/v1/auth/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${loginBody.data.accessToken}`,
    },
  });

  const result = await response.json();

  assertEquals(response.status, 200);
  assertEquals(result.success, true);
  assertEquals(result.data.email, TEST_USERS.admin.email);
});

Deno.test("FR-01 /auth/me without token should fail", async () => {
  const response = await app.request("/api/v1/auth/me");

  assertEquals(response.status, 401);
});

Deno.test("FR-01 logout endpoint should succeed", async () => {
  await setupTestUsers();

  const { response: loginResponse, body: loginBody } = await login();

  assertEquals(
    loginResponse.status,
    200,
    `Login failed: ${JSON.stringify(loginBody)}`,
  );

  assertExists(loginBody.data);
  assertExists(loginBody.data.accessToken);

  const response = await app.request("/api/v1/auth/logout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${loginBody.data.accessToken}`,
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

  assertEquals(
    response.status,
    200,
    `First-login authentication failed: ${JSON.stringify(body)}`,
  );

  assertEquals(body.success, true);

  assertExists(body.data);
  assertExists(body.data.user);

  assertEquals(
    body.data.user.mustChangePassword,
    true,
    "First login user should be required to change password",
  );
});

Deno.test("FR-01 password change should clear first login state", async () => {
  /*
   * Reset the first-login test user to a known state.
   *
   * setupTestUsers() is expected to:
   *
   * - restore the original password
   * - restore must_change_password = true
   */
  await setupTestUsers();

  /*
   * ----------------------------------------------------------
   * 1. First login
   * ----------------------------------------------------------
   */
  const firstLogin = await login(
    TEST_USERS.firstLogin.email,
    TEST_USERS.firstLogin.password,
  );

  assertEquals(
    firstLogin.response.status,
    200,
    `First-login authentication failed: ${JSON.stringify(firstLogin.body)}`,
  );

  assertEquals(
    firstLogin.body.success,
    true,
    `Expected successful first login: ${JSON.stringify(firstLogin.body)}`,
  );

  assertExists(
    firstLogin.body.data,
    `Expected login data: ${JSON.stringify(firstLogin.body)}`,
  );

  assertExists(
    firstLogin.body.data.accessToken,
    `Expected first-login access token: ${JSON.stringify(firstLogin.body)}`,
  );

  assertExists(
    firstLogin.body.data.user,
    `Expected first-login user: ${JSON.stringify(firstLogin.body)}`,
  );

  /*
   * Confirm that the user is actually in first-login state.
   */
  assertEquals(
    firstLogin.body.data.user.mustChangePassword,
    true,
    `Expected first-login user to require password change: ${
      JSON.stringify(
        firstLogin.body,
      )
    }`,
  );

  const oldToken = firstLogin.body.data.accessToken;

  /*
   * ----------------------------------------------------------
   * 2. Change password
   * ----------------------------------------------------------
   */
  const changeResponse = await app.request("/api/v1/auth/change-password", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${oldToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      newPassword: TEST_USERS.firstLogin.newPassword,
    }),
  });

  const changeBody = await changeResponse.json();

  assertEquals(
    changeResponse.status,
    200,
    `Password change failed: ${JSON.stringify(changeBody)}`,
  );

  assertEquals(
    changeBody.success,
    true,
    `Expected successful password change: ${JSON.stringify(changeBody)}`,
  );

  /*
   * ----------------------------------------------------------
   * 3. Login using the new password
   * ----------------------------------------------------------
   *
   * Do not reuse the old access token.
   *
   * A successful password change may invalidate the previous
   * Supabase session, so perform a fresh login.
   */
  const newLogin = await login(
    TEST_USERS.firstLogin.email,
    TEST_USERS.firstLogin.newPassword,
  );

  assertEquals(
    newLogin.response.status,
    200,
    `Login with new password failed: ${JSON.stringify(newLogin.body)}`,
  );

  assertEquals(
    newLogin.body.success,
    true,
    `Expected successful login with new password: ${
      JSON.stringify(
        newLogin.body,
      )
    }`,
  );

  assertExists(
    newLogin.body.data,
    `Expected new-login data: ${JSON.stringify(newLogin.body)}`,
  );

  assertExists(
    newLogin.body.data.accessToken,
    `Expected new access token: ${JSON.stringify(newLogin.body)}`,
  );

  const newToken = newLogin.body.data.accessToken;

  /*
   * ----------------------------------------------------------
   * 4. Verify /auth/me
   * ----------------------------------------------------------
   *
   * This verifies the persisted profile state after the
   * password change.
   */
  const meResponse = await app.request("/api/v1/auth/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${newToken}`,
    },
  });

  const meBody = await meResponse.json();

  assertEquals(
    meResponse.status,
    200,
    `Authenticated /auth/me failed: ${JSON.stringify(meBody)}`,
  );

  assertEquals(
    meBody.success,
    true,
    `Expected successful /auth/me response: ${JSON.stringify(meBody)}`,
  );

  assertExists(
    meBody.data,
    `Expected /auth/me data: ${JSON.stringify(meBody)}`,
  );

  assertEquals(
    meBody.data.email,
    TEST_USERS.firstLogin.email,
    "Authenticated user should be the first-login test user",
  );

  /*
   * ----------------------------------------------------------
   * Requirement under test
   * ----------------------------------------------------------
   *
   * First login:
   *
   *     mustChangePassword = true
   *
   * After successful password change:
   *
   *     mustChangePassword = false
   */
  assertEquals(
    meBody.data.mustChangePassword,
    false,
    `Expected mustChangePassword=false after password change: ${
      JSON.stringify(
        meBody,
      )
    }`,
  );
});
