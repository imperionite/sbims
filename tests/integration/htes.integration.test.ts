import { assertEquals, assertExists } from "@std/assert";

import { createApp } from "../../src/app.ts";

import { setupTestUsers } from "../helpers/test-user.setup.ts";
import { TEST_USERS } from "../fixtures/test-users.ts";

import { loadEnv } from "../../src/config/env.ts";
import { getDenoEnv } from "../../src/config/runtime.ts";

const env = loadEnv(getDenoEnv());

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

async function authenticatedRequest(
  path: string,
  token: string,
  options: RequestInit = {},
) {
  return await app.request(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });
}

async function createTestHte(token: string) {
  const response = await authenticatedRequest("/api/v1/htes", token, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      companyName: `FR04 Test HTE ${crypto.randomUUID()}`,
      address: "Test Address, Bulacan",
      contactPerson: "Test Contact Person",
      contactEmail: "contact@example.com",
      contactNumber: "09171234567",
    }),
  });

  const body = await response.json();

  assertEquals(response.status, 201);
  assertEquals(body.success, true);
  assertExists(body.data);

  return body.data;
}

Deno.test("FR-04 administrator can list HTE profiles", async () => {
  await setupTestUsers();

  const { response: loginResponse, body: loginBody } = await login();

  assertEquals(loginResponse.status, 200);

  const response = await authenticatedRequest(
    "/api/v1/htes",
    loginBody.data.accessToken,
  );

  const body = await response.json();

  assertEquals(response.status, 200);
  assertEquals(body.success, true);
  assertExists(body.data);
});

Deno.test("FR-04 administrator can create an HTE profile", async () => {
  await setupTestUsers();

  const { response: loginResponse, body: loginBody } = await login();

  assertEquals(loginResponse.status, 200);

  const hte = await createTestHte(loginBody.data.accessToken);

  assertExists(hte.id);
  assertEquals(hte.company_name.startsWith("FR04 Test HTE "), true);
  assertEquals(hte.address, "Test Address, Bulacan");
  assertEquals(hte.contact_person, "Test Contact Person");
  assertEquals(hte.contact_email, "contact@example.com");
  assertEquals(hte.contact_number, "09171234567");
  assertEquals(hte.is_active, true);
  assertExists(hte.created_at);
  assertExists(hte.updated_at);
});

Deno.test("FR-04 administrator can retrieve an HTE profile", async () => {
  await setupTestUsers();

  const { response: loginResponse, body: loginBody } = await login();

  assertEquals(loginResponse.status, 200);

  const hte = await createTestHte(loginBody.data.accessToken);

  const response = await authenticatedRequest(
    `/api/v1/htes/${hte.id}`,
    loginBody.data.accessToken,
  );

  const body = await response.json();

  assertEquals(response.status, 200);
  assertEquals(body.success, true);
  assertEquals(body.data.id, hte.id);
});

Deno.test("FR-04 administrator can update an HTE profile", async () => {
  await setupTestUsers();

  const { response: loginResponse, body: loginBody } = await login();

  assertEquals(loginResponse.status, 200);

  const hte = await createTestHte(loginBody.data.accessToken);

  const response = await authenticatedRequest(
    `/api/v1/htes/${hte.id}`,
    loginBody.data.accessToken,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        companyName: "Updated FR-04 Test HTE",
        contactPerson: "Updated Contact Person",
      }),
    },
  );

  const body = await response.json();

  assertEquals(response.status, 200);
  assertEquals(body.success, true);
  assertEquals(body.data.id, hte.id);
  assertEquals(body.data.company_name, "Updated FR-04 Test HTE");
  assertEquals(body.data.contact_person, "Updated Contact Person");
  assertEquals(body.data.address, hte.address);
});

Deno.test(
  "FR-04 administrator can deactivate and reactivate an HTE",
  async () => {
    await setupTestUsers();

    const { response: loginResponse, body: loginBody } = await login();

    assertEquals(loginResponse.status, 200);

    const hte = await createTestHte(loginBody.data.accessToken);

    const deactivateResponse = await authenticatedRequest(
      `/api/v1/htes/${hte.id}/status`,
      loginBody.data.accessToken,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isActive: false,
        }),
      },
    );

    const deactivateBody = await deactivateResponse.json();

    assertEquals(deactivateResponse.status, 200);
    assertEquals(deactivateBody.success, true);
    assertEquals(deactivateBody.data.is_active, false);

    const reactivateResponse = await authenticatedRequest(
      `/api/v1/htes/${hte.id}/status`,
      loginBody.data.accessToken,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isActive: true,
        }),
      },
    );

    const reactivateBody = await reactivateResponse.json();

    assertEquals(reactivateResponse.status, 200);
    assertEquals(reactivateBody.success, true);
    assertEquals(reactivateBody.data.is_active, true);
  },
);

Deno.test("FR-04 unauthenticated HTE request should fail", async () => {
  const response = await app.request("/api/v1/htes");

  assertEquals(response.status, 401);
});

Deno.test("FR-04 student cannot manage HTE profiles", async () => {
  await setupTestUsers();

  const { response: loginResponse, body: loginBody } = await login(
    TEST_USERS.student.email,
    TEST_USERS.student.password,
  );

  assertEquals(loginResponse.status, 200);

  const response = await authenticatedRequest(
    "/api/v1/htes",
    loginBody.data.accessToken,
  );

  assertEquals(response.status, 403);
});

Deno.test("FR-04 invalid HTE data should be rejected", async () => {
  await setupTestUsers();

  const { response: loginResponse, body: loginBody } = await login();

  assertEquals(loginResponse.status, 200);

  const response = await authenticatedRequest(
    "/api/v1/htes",
    loginBody.data.accessToken,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        companyName: "",
        address: "",
        contactPerson: "",
        contactEmail: "not-an-email",
      }),
    },
  );

  assertEquals(response.status, 400);
});

Deno.test("FR-04 missing required HTE fields should be rejected", async () => {
  await setupTestUsers();

  const { response: loginResponse, body: loginBody } = await login();

  assertEquals(loginResponse.status, 200);

  const response = await authenticatedRequest(
    "/api/v1/htes",
    loginBody.data.accessToken,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        companyName: "Incomplete HTE",
      }),
    },
  );

  assertEquals(response.status, 400);
});

Deno.test("FR-04 non-existent HTE should return 404", async () => {
  await setupTestUsers();

  const { response: loginResponse, body: loginBody } = await login();

  assertEquals(loginResponse.status, 200);

  const response = await authenticatedRequest(
    "/api/v1/htes/00000000-0000-0000-0000-000000000000",
    loginBody.data.accessToken,
  );

  assertEquals(response.status, 404);
});

Deno.test("FR-04 empty HTE update should be rejected", async () => {
  await setupTestUsers();

  const { response: loginResponse, body: loginBody } = await login();

  assertEquals(loginResponse.status, 200);

  const hte = await createTestHte(loginBody.data.accessToken);

  const response = await authenticatedRequest(
    `/api/v1/htes/${hte.id}`,
    loginBody.data.accessToken,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    },
  );

  assertEquals(response.status, 400);
});
