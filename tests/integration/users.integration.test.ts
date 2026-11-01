import { assertEquals, assertExists } from "@std/assert";

import { createApp } from "../../src/app.ts";
import { createSupabaseClients } from "../../src/lib/supabase.ts";
import { loadEnv } from "../../src/config/env.ts";
import { getDenoEnv } from "../../src/config/runtime.ts";

import { setupTestUsers } from "../helpers/test-user.setup.ts";
import { assertAuditEvent } from "../helpers/audit.assertions.ts";

import { TEST_USERS } from "../fixtures/test-users.ts";

const env = {
  ...loadEnv(getDenoEnv()),
  ENVIRONMENT: "test" as const,
  RATE_LIMIT_ENABLED: false,
};

const app = createApp(env);

const { supabaseAdmin } = createSupabaseClients(env);

// ============================================================
// Authentication helpers
// ============================================================

async function login(email: string, password: string) {
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

async function getAdminToken(): Promise<string> {
  const { response, body } = await login(
    TEST_USERS.admin.email,
    TEST_USERS.admin.password,
  );

  assertEquals(response.status, 200);
  assertEquals(body.success, true);
  assertExists(body.data.accessToken);

  return body.data.accessToken;
}

async function getStudentToken(): Promise<string> {
  const { response, body } = await login(
    TEST_USERS.student.email,
    TEST_USERS.student.password,
  );

  assertEquals(response.status, 200);
  assertEquals(body.success, true);
  assertExists(body.data.accessToken);

  return body.data.accessToken;
}

// ============================================================
// User lookup helpers
// ============================================================

async function getUserIdByEmail(email: string): Promise<string> {
  const adminToken = await getAdminToken();

  const response = await app.request("/api/v1/users", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  });

  const body = await response.json();

  assertEquals(response.status, 200);
  assertEquals(body.success, true);

  const user = body.data.find(
    (item: { email: string; id: string }) => item.email.toLowerCase() === email.toLowerCase(),
  );

  if (!user) {
    throw new Error(`Unable to resolve user id for ${email}`);
  }

  return user.id;
}

// ============================================================
// Test 1 — Administrator access
// ============================================================

Deno.test("FR-02 administrator should access user management", async () => {
  await setupTestUsers();

  const token = await getAdminToken();

  const response = await app.request("/api/v1/users", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const result = await response.json();

  assertEquals(response.status, 200);
  assertEquals(result.success, true);
});

// ============================================================
// Test 2 — Student access restriction
// ============================================================

Deno.test("FR-02 student should not access user management", async () => {
  await setupTestUsers();

  const token = await getStudentToken();

  const response = await app.request("/api/v1/users", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  assertEquals(response.status, 403);
});

// ============================================================
// Test 3 — Unauthenticated access restriction
// ============================================================

Deno.test("FR-02 unauthenticated request should fail", async () => {
  const response = await app.request("/api/v1/users");

  assertEquals(response.status, 401);
});

// ============================================================
// Test 4 — Retrieve user list
// ============================================================

Deno.test("FR-02 administrator can retrieve user list", async () => {
  await setupTestUsers();

  const token = await getAdminToken();

  const response = await app.request("/api/v1/users", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const result = await response.json();

  assertEquals(response.status, 200);
  assertEquals(Array.isArray(result.data), true);
});

// ============================================================
// Test 5 — Retrieve individual user
// ============================================================

Deno.test("FR-02 administrator can retrieve single user", async () => {
  await setupTestUsers();

  const token = await getAdminToken();

  const userId = await getUserIdByEmail(TEST_USERS.admin.email);

  const response = await app.request(`/api/v1/users/${userId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const result = await response.json();

  assertEquals(response.status, 200);
  assertEquals(result.success, true);
  assertEquals(result.data.id, userId);
});

// ============================================================
// Test 6 — Update user profile and verify audit event
// ============================================================

Deno.test(
  "FR-02 administrator can update user profile and generate audit event",
  async () => {
    await setupTestUsers();

    const token = await getAdminToken();

    const adminId = await getUserIdByEmail(TEST_USERS.admin.email);
    const targetUserId = await getUserIdByEmail(TEST_USERS.student.email);

    const response = await app.request(`/api/v1/users/${targetUserId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        firstName: "Updated",
        lastName: "Student",
      }),
    });

    const result = await response.json();

    assertEquals(response.status, 200);
    assertEquals(result.success, true);

    // Verify that the successful profile update was audited.
    await assertAuditEvent(supabaseAdmin, {
      actorId: adminId,
      action: "UPDATE_USER",
      resourceType: "user",
      resourceId: targetUserId,
    });
  },
);

// ============================================================
// Test 7 — Change user role and verify audit event
// ============================================================

Deno.test(
  "FR-02 administrator can change user role and generate audit event",
  async () => {
    await setupTestUsers();

    const token = await getAdminToken();

    const adminId = await getUserIdByEmail(TEST_USERS.admin.email);
    const targetUserId = await getUserIdByEmail(TEST_USERS.coordinator.email);

    const response = await app.request(
      `/api/v1/users/${targetUserId}/role`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: "faculty_adviser",
        }),
      },
    );

    const result = await response.json();

    assertEquals(response.status, 200);
    assertEquals(result.success, true);

    // Verify that the successful role change was audited.
    await assertAuditEvent(supabaseAdmin, {
      actorId: adminId,
      action: "CHANGE_ROLE",
      resourceType: "user",
      resourceId: targetUserId,
    });
  },
);

// ============================================================
// Test 8 — Student cannot retrieve individual user
// ============================================================

Deno.test("FR-02 student cannot retrieve single user", async () => {
  await setupTestUsers();

  const token = await getStudentToken();

  const userId = await getUserIdByEmail(TEST_USERS.admin.email);

  const response = await app.request(`/api/v1/users/${userId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  assertEquals(response.status, 403);
});

// ============================================================
// Test 9 — Student cannot change user role
// ============================================================

Deno.test("FR-02 student cannot update user role", async () => {
  await setupTestUsers();

  const token = await getStudentToken();

  const userId = await getUserIdByEmail(TEST_USERS.admin.email);

  const response = await app.request(`/api/v1/users/${userId}/role`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      role: "administrator",
    }),
  });

  assertEquals(response.status, 403);
});

// ============================================================
// Test 10 — Denied role-change attempt does not mutate data
// ============================================================

Deno.test(
  "FR-02 denied student role-change attempt leaves target role unchanged",
  async () => {
    await setupTestUsers();

    const studentToken = await getStudentToken();
    const adminToken = await getAdminToken();

    const targetUserId = await getUserIdByEmail(
      TEST_USERS.coordinator.email,
    );

    const deniedResponse = await app.request(
      `/api/v1/users/${targetUserId}/role`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${studentToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: "administrator",
        }),
      },
    );

    assertEquals(deniedResponse.status, 403);

    const verificationResponse = await app.request(
      `/api/v1/users/${targetUserId}`,
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      },
    );

    const verificationBody = await verificationResponse.json();

    assertEquals(verificationResponse.status, 200);
    assertEquals(verificationBody.data.id, targetUserId);

    assertEquals(
      verificationBody.data.role,
      "internship_coordinator",
      "Denied role-change request must not mutate the target user's role",
    );
  },
);
