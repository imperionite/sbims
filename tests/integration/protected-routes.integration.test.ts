//deno test protected-routes.integration.test.ts --allow-env --allow-net

import { assertEquals, assertExists } from "@std/assert";

import { createApp } from "../../src/app.ts";
import { loadEnv } from "../../src/config/env.ts";
import { getDenoEnv } from "../../src/config/runtime.ts";
import { createSupabaseClients } from "../../src/lib/supabase.ts";
import { TEST_USERS } from "../fixtures/test-users.ts";
import { setupTestUsers } from "../helpers/test-user.setup.ts";

const env = loadEnv({
  ...getDenoEnv(),
  RATE_LIMIT_ENABLED: "false",
});

const app = createApp(env);
const { supabaseAdmin } = createSupabaseClients(env);

const protectedEndpoints = [
  { method: "POST", path: "/api/v1/auth/reset-password/complete" },
  { method: "POST", path: "/api/v1/auth/change-password" },
  { method: "GET", path: "/api/v1/auth/me" },
  { method: "POST", path: "/api/v1/auth/logout" },
  { method: "GET", path: "/api/v1/auth/role" },
  { method: "GET", path: "/api/v1/auth/admin-check" },

  // User endpoints
  { method: "GET", path: "/api/v1/users" },
  { method: "GET", path: "/api/v1/users/role/student" },
  { method: "GET", path: "/api/v1/users/test-user-id" },
  { method: "POST", path: "/api/v1/users" },
  { method: "PATCH", path: "/api/v1/users/test-user-id" },
  { method: "PATCH", path: "/api/v1/users/test-user-id/role" },
  { method: "PATCH", path: "/api/v1/users/test-user-id/status" },

  // Student endpoints
  { method: "GET", path: "/api/v1/students" },
  { method: "GET", path: "/api/v1/students/assigned" },
  { method: "GET", path: "/api/v1/students/me" },
  { method: "PATCH", path: "/api/v1/students/me" },
  { method: "GET", path: "/api/v1/students/test-student-id" },
  { method: "POST", path: "/api/v1/students" },
  { method: "PATCH", path: "/api/v1/students/test-student-id" },

  // HTE endpoints
  { method: "GET", path: "/api/v1/htes/my/students" },
  { method: "GET", path: "/api/v1/htes" },
  { method: "GET", path: "/api/v1/htes/test-hte-id/students" },
  { method: "GET", path: "/api/v1/htes/test-hte-id" },
  { method: "POST", path: "/api/v1/htes" },
  { method: "PATCH", path: "/api/v1/htes/test-hte-id" },
  { method: "PATCH", path: "/api/v1/htes/test-hte-id/status" },
  { method: "PATCH", path: "/api/v1/htes/test-hte-id/supervisor" },

  //Internship endpoints
  { method: "GET", path: "/api/v1/internships" },
  { method: "GET", path: "/api/v1/internships/me" },
  { method: "POST", path: "/api/v1/internships" },
  { method: "POST", path: "/api/v1/internships/me" },
  { method: "GET", path: "/api/v1/internships/test-internship-id" },
  { method: "PATCH", path: "/api/v1/internships/test-internship-id/status" },
  { method: "PATCH", path: "/api/v1/internships/test-internship-id/adviser" },
  { method: "PATCH", path: "/api/v1/internships/test-internship-id" },

  //Attendance endpoints
  { method: "POST", path: "/api/v1/attendance" },
  { method: "GET", path: "/api/v1/attendance/me" },
  { method: "GET", path: "/api/v1/attendance/internship/test-internship-id" },
  {
    method: "GET",
    path: "/api/v1/attendance/internship/test-internship-id/rendered-hours",
  },
  { method: "GET", path: "/api/v1/attendance/test-attendance-id" },
  { method: "PATCH", path: "/api/v1/attendance/test-attendance-id" },
  {
    method: "PATCH",
    path: "/api/v1/attendance/test-attendance-id/validation",
  },

  //Evaluation endpoints
  { method: "POST", path: "/api/v1/evaluations" },
  { method: "GET", path: "/api/v1/evaluations/me" },
  {
    method: "GET",
    path: "/api/v1/evaluations/internship/test-internship-id",
  },
  { method: "GET", path: "/api/v1/evaluations/test-evaluation-id" },
  { method: "PATCH", path: "/api/v1/evaluations/test-evaluation-id" },
  { method: "POST", path: "/api/v1/evaluations/test-evaluation-id/submit" },
  { method: "POST", path: "/api/v1/documents" },
  { method: "GET", path: "/api/v1/documents/internship/test-internship-id" },
  { method: "GET", path: "/api/v1/documents/test-document-id" },
  { method: "DELETE", path: "/api/v1/documents/test-document-id" },
  { method: "PATCH", path: "/api/v1/documents/test-document-id/approve" },
  { method: "PATCH", path: "/api/v1/documents/test-document-id/reject" },
  { method: "GET", path: "/api/v1/reports/internships" },
  { method: "GET", path: "/api/v1/reports/internships/summary" },
  { method: "GET", path: "/api/v1/audit-logs" },
] as const;

type CheckSummary = {
  scenario: string;
  tested: number;
  passed: number;
  failed: number;
};

const checkSummaries: CheckSummary[] = [];

async function assertEndpointsRejectRequests(
  scenario: string,
  headers: HeadersInit = {},
) {
  let passed = 0;
  const failures: string[] = [];

  for (const endpoint of protectedEndpoints) {
    const response = await app.request(endpoint.path, {
      method: endpoint.method,
      headers,
    });

    if (response.status === 401) {
      passed++;
    } else {
      failures.push(
        `${endpoint.method} ${endpoint.path} returned ${response.status}`,
      );
    }
  }

  console.log(
    `${scenario}: ${protectedEndpoints.length} endpoints tested, ${passed} passed, ${failures.length} failed.`,
  );
  checkSummaries.push({
    scenario,
    tested: protectedEndpoints.length,
    passed,
    failed: failures.length,
  });
  assertEquals(
    failures.length,
    0,
    failures.length > 0 ? `Unexpected responses:\n${failures.join("\n")}` : "",
  );
}

Deno.test("Protected endpoint authentication checks", async (t) => {
  await t.step("Protected endpoints reject requests without tokens", async () => {
    await assertEndpointsRejectRequests("Missing-token check");
  });

  await t.step("Protected endpoints reject invalid tokens", async () => {
    let passed = 0;
    const failures: string[] = [];

    for (const endpoint of protectedEndpoints) {
      const response = await app.request(endpoint.path, {
        method: endpoint.method,
        headers: {
          Authorization: "Bearer invalid-token",
        },
      });

      if (response.status === 401) {
        passed++;
      } else {
        failures.push(
          `${endpoint.method} ${endpoint.path} returned ${response.status}`,
        );
      }
    }

    console.log(
      `Invalid-token check: ${protectedEndpoints.length} endpoints tested, ${passed} passed, ${failures.length} failed.`,
    );
    checkSummaries.push({
      scenario: "Invalid-token check",
      tested: protectedEndpoints.length,
      passed,
      failed: failures.length,
    });
    assertEquals(
      failures.length,
      0,
      failures.length > 0 ? `Unexpected responses:\n${failures.join("\n")}` : "",
    );
  });

  await t.step("Protected endpoints reject expired tokens", async () => {
    let passed = 0;
    const failures: string[] = [];

    for (const endpoint of protectedEndpoints) {
      const response = await app.request(endpoint.path, {
        method: endpoint.method,
        headers: {
          Authorization:
            "Bearer eyJhbGciOiJFUzI1NiIsImtpZCI6IjI4OGQ4NzFhLWEzZDItNDA0Ni04Y2QwLTJlZTJhZmM1NmY4ZiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2NycnBzcXp2bGx4bXh0c3dkaGh6LnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI3OGUxNDVkMi1hN2M3LTRkM2MtOWMzZS04MDI2YTc2NGM1NGUiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzk0MzMwNzE3LCJpYXQiOjE3OTQzMjcxMTcsImVtYWlsIjoiY29vcmRpbmF0b3JzYmltczJAZ3JyLmxhIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCJdfSwidXNlcl9tZXRhZGF0YSI6eyJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiZmlyc3RfbmFtZSI6IkdhYnJpZWwiLCJsYXN0X25hbWUiOiJWaWxsYW51ZXZhIiwibWlkZGxlX25hbWUiOiJTYW50b3MiLCJyb2xlIjoiaW50ZXJuc2hpcF9jb29yZGluYXRvciIsInNlZWRfa2V5IjoiaW50ZXJuc2hpcC1jb29yZGluYXRvci0wMiIsInN1ZmZpeCI6bnVsbH0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjE3OTQzMjcxMTd9XSwic2Vzc2lvbl9pZCI6ImFjMDkyODcxLTkwZmEtNDJhNi1hMjhmLWRiNjA1MWJjZjc2NCIsImlzX2Fub255bW91cyI6ZmFsc2V9.-X8wmJrilz7qpHL4WtpaQ-g7EXUFl8VXCxE-lR8h6OwVOww3Ec6newIRUm75lBNKuvMS8EUui27jICNukFiUfQ",
        },
      });

      if (response.status === 401) {
        passed++;
      } else {
        failures.push(
          `${endpoint.method} ${endpoint.path} returned ${response.status}`,
        );
      }
    }

    console.log(
      `Expired-token check: ${protectedEndpoints.length} endpoints tested, ${passed} passed, ${failures.length} failed.`,
    );
    checkSummaries.push({
      scenario: "Expired-token check",
      tested: protectedEndpoints.length,
      passed,
      failed: failures.length,
    });
    assertEquals(
      failures.length,
      0,
      failures.length > 0 ? `Unexpected responses:\n${failures.join("\n")}` : "",
    );
  });

  await t.step(
    "Protected endpoints reject sessions for deactivated accounts",
    async () => {
      await setupTestUsers();

      const loginResponse = await app.request("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: TEST_USERS.student.email,
          password: TEST_USERS.student.password,
        }),
      });
      assertEquals(loginResponse.status, 200, "Test account should be able to log in");

      const loginBody = await loginResponse.json();
      assertExists(loginBody.data?.accessToken);
      const accessToken: string = loginBody.data.accessToken;

      const { error: deactivateError } = await supabaseAdmin
        .from("profiles")
        .update({ is_active: false })
        .eq("email", TEST_USERS.student.email);

      if (deactivateError) {
        throw deactivateError;
      }

      let passed = 0;
      const failures: string[] = [];

      try {
        for (const endpoint of protectedEndpoints) {
          const response = await app.request(endpoint.path, {
            method: endpoint.method,
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          if (response.status === 403) {
            passed++;
          } else {
            failures.push(
              `${endpoint.method} ${endpoint.path} returned ${response.status}`,
            );
          }
        }

        console.log(
          `Deactivated-account check: ${protectedEndpoints.length} endpoints tested, ${passed} passed, ${failures.length} failed.`,
        );
        checkSummaries.push({
          scenario: "Deactivated-account check",
          tested: protectedEndpoints.length,
          passed,
          failed: failures.length,
        });
        assertEquals(
          failures.length,
          0,
          failures.length > 0 ? `Unexpected responses:\n${failures.join("\n")}` : "",
        );
      } finally {
        const { error: restoreError } = await supabaseAdmin
          .from("profiles")
          .update({ is_active: true })
          .eq("email", TEST_USERS.student.email);

        if (restoreError) {
          throw restoreError;
        }
      }
    },
  );

  const total = checkSummaries.reduce(
    (summary, check) => ({
      tested: summary.tested + check.tested,
      passed: summary.passed + check.passed,
      failed: summary.failed + check.failed,
    }),
    { tested: 0, passed: 0, failed: 0 },
  );

  console.log("\nProtected endpoint authentication summary");
  console.log("| Check | Tested | Passed | Failed |");
  console.log("|---|---:|---:|---:|");
  for (const check of checkSummaries) {
    console.log(
      `| ${check.scenario} | ${check.tested} | ${check.passed} | ${check.failed} |`,
    );
  }
  console.log(
    `| **Total** | **${total.tested}** | **${total.passed}** | **${total.failed}** |`,
  );
});
