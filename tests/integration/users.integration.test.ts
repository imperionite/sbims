import { assertEquals } from "@std/assert";

import { app } from "../../src/app.ts";

import { setupTestUsers } from "../helpers/test-user.setup.ts";

import { TEST_USERS } from "../fixtures/test-users.ts";

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

async function getUserIdByEmail(email: string) {
  const response = await app.request(`/api/v1/users`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${await getAdminToken()}`,
    },
  });

  const body = await response.json();

  const user = body.data.find(
    (item: { email: string; id: string }) => item.email.toLowerCase() === email.toLowerCase(),
  );

  if (!user) {
    throw new Error(`Unable to resolve user id for ${email}`);
  }

  return user.id;
}

async function getAdminToken() {
  const { body } = await login(
    TEST_USERS.admin.email,
    TEST_USERS.admin.password,
  );

  return body.data.accessToken;
}

async function getStudentToken() {
  const { body } = await login(
    TEST_USERS.student.email,
    TEST_USERS.student.password,
  );

  return body.data.accessToken;
}

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

Deno.test("FR-02 unauthenticated request should fail", async () => {
  const response = await app.request("/api/v1/users");

  assertEquals(response.status, 401);
});

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

Deno.test("FR-02 administrator can update user profile", async () => {
  await setupTestUsers();

  const token = await getAdminToken();

  const userId = await getUserIdByEmail(TEST_USERS.admin.email);

  const response = await app.request(`/api/v1/users/${userId}`, {
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
});

Deno.test("FR-02 administrator can change user role", async () => {
  await setupTestUsers();

  const token = await getAdminToken();

  const userId = await getUserIdByEmail(TEST_USERS.admin.email);

  const response = await app.request(`/api/v1/users/${userId}/role`, {
    method: "PATCH",

    headers: {
      Authorization: `Bearer ${token}`,

      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      role: "faculty_adviser",
    }),
  });

  const result = await response.json();

  assertEquals(response.status, 200);

  assertEquals(result.success, true);
});

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
