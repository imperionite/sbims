import { assertEquals, assertExists } from "@std/assert";

import { createApp } from "../../src/app.ts";
import { loadEnv } from "../../src/config/env.ts";
import { getDenoEnv } from "../../src/config/runtime.ts";
import { setupTestUsers } from "../helpers/test-user.setup.ts";
import { TEST_USERS } from "../fixtures/test-users.ts";

const env = loadEnv({
  ...getDenoEnv(),
  RATE_LIMIT_ENABLED: "false",
});
const app = createApp(env);

type LoginResult = {
  response: Response;
  accessToken: string;
};

async function login(email: string, password: string): Promise<LoginResult> {
  const response = await app.request("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json();
  assertEquals(response.status, 200, `Login failed for ${email}`);
  assertExists(body.data?.accessToken);
  return { response, accessToken: body.data.accessToken };
}

async function requestAs(path: string, token: string): Promise<Response> {
  return await app.request(path, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

const roleUsers = [
  { name: "administrator", user: TEST_USERS.admin },
  { name: "internship coordinator", user: TEST_USERS.coordinator },
  { name: "student", user: TEST_USERS.student },
  { name: "HTE supervisor", user: TEST_USERS.hteSupervisor },
  { name: "faculty adviser", user: TEST_USERS.facultyAdviser },
] as const;

Deno.test(
  "RBAC integration: protected institutional endpoints enforce role boundaries",
  async () => {
    await setupTestUsers();

    const tokens = new Map<string, string>();
    for (const entry of roleUsers) {
      tokens.set(
        entry.name,
        (await login(entry.user.email, entry.user.password)).accessToken,
      );
    }

    const cases = [
      {
        path: "/api/v1/users",
        allowed: new Set(["administrator", "internship coordinator"]),
        label: "user management",
      },
      {
        path: "/api/v1/htes",
        allowed: new Set(["administrator", "internship coordinator"]),
        label: "HTE management",
      },
      {
        path: "/api/v1/reports/internships",
        allowed: new Set(["administrator", "internship coordinator"]),
        label: "internship reports",
      },
      {
        path: "/api/v1/reports/internships/summary",
        allowed: new Set(["administrator", "internship coordinator"]),
        label: "internship report summary",
      },
      {
        path: "/api/v1/audit-logs",
        allowed: new Set(["administrator"]),
        label: "audit logs",
      },
    ] as const;

    for (const testCase of cases) {
      for (const entry of roleUsers) {
        const token = tokens.get(entry.name);
        assertExists(token);
        const response = await requestAs(testCase.path, token);
        const shouldAllow = testCase.allowed.has(entry.name);

        assertEquals(
          response.status,
          shouldAllow ? 200 : 403,
          `${entry.name} access to ${testCase.label} at ${testCase.path}`,
        );

        if (!shouldAllow) {
          const body = await response.json();
          assertEquals(
            body.success,
            false,
            `Denied ${testCase.label} response should not report success`,
          );
        }
      }
    }
  },
);

Deno.test(
  "RBAC integration: protected institutional endpoints reject unauthenticated requests",
  async () => {
    const paths = [
      "/api/v1/users",
      "/api/v1/htes",
      "/api/v1/reports/internships",
      "/api/v1/reports/internships/summary",
      "/api/v1/audit-logs",
    ];

    for (const path of paths) {
      const response = await app.request(path);
      assertEquals(response.status, 401, `Unauthenticated access to ${path}`);
    }
  },
);
