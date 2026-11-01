// deno-lint-ignore-file no-explicit-any require-await
import { assertEquals, assertExists } from "@std/assert";
import { Hono } from "hono";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { AppVariables } from "../../src/types/context.ts";
import attendance from "../../src/modules/attendance/attendance.routes.ts";
import { assertAuditEvent } from "../helpers/audit.assertions.ts";

// ============================================================
// Test constants
// ============================================================

const INTERNSHIP_ID = "550e8400-e29b-41d4-a716-446655440000";

// ============================================================
// Test date helpers
// ============================================================

const TEST_TODAY = new Date();

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(days: number, baseDate = TEST_TODAY): string {
  const date = new Date(baseDate);
  date.setUTCDate(date.getUTCDate() + days);
  return dateOnly(date);
}

function today(): string {
  return addDays(0);
}

function yesterday(): string {
  return addDays(-1);
}

// ============================================================
// Integration test app
// ============================================================

function createIntegrationApp() {
  const app = new Hono<{
    Variables: AppVariables;
  }>();

  // One mock instance is shared across all requests made to this app.
  const mockSupabase = createMockSupabase();

  app.use("*", async (c, next) => {
    c.set("supabase", mockSupabase as any);
    await next();
  });

  app.route("/attendance", attendance);

  app.onError((error, c) => {
    const status = "status" in error && typeof error.status === "number" ? error.status : 500;

    return c.json(
      {
        success: false,
        message: error.message,
      },
      status as any,
    );
  });

  // Expose the same mock instance so tests can inspect persisted audit rows.
  return Object.assign(app, { mockSupabase });
}

// ============================================================
// Mock Supabase
// ============================================================

function createMockSupabase() {
  const data = {
    internships: [
      {
        id: INTERNSHIP_ID,
        student_id: "student-1",
        status: "active",
        start_date: addDays(-30),
        end_date: addDays(30),
      },
    ],

    attendance_records: [
      {
        id: "attendance-1",
        internship_id: INTERNSHIP_ID,
        attendance_date: yesterday(),
        time_in: "08:00",
        time_out: "17:00",
        validation_status: "pending",
        validated_by: null,
        validated_at: null,
      },
    ],

    profiles: [
      {
        id: "student-1",
        role: "student",
        is_active: true,
      },
      {
        id: "student-2",
        role: "student",
        is_active: true,
      },
      {
        id: "coordinator-1",
        role: "internship_coordinator",
        is_active: true,
      },
    ],

    audit_logs: [] as any[],
  };

  // ----------------------------------------------------------
  // Query builder
  // ----------------------------------------------------------

  const makeBuilder = (table: keyof typeof data, rows: any[]) => {
    let filtered = [...rows];

    const builder: any = {
      select() {
        return builder;
      },

      eq(column: string, value: unknown) {
        filtered = filtered.filter((row) => {
          if (column.includes(".")) {
            const [relation, relationColumn] = column.split(".");

            if (relation === "internships" && table === "attendance_records") {
              const internship = data.internships.find(
                (item) => item.id === row.internship_id,
              ) as Record<string, unknown> | undefined;

              return internship?.[relationColumn] === value;
            }
          }

          return row[column] === value;
        });

        return builder;
      },

      neq(column: string, value: unknown) {
        filtered = filtered.filter((row) => row[column] !== value);
        return builder;
      },

      in(column: string, values: unknown[]) {
        filtered = filtered.filter((row) => values.includes(row[column]));
        return builder;
      },

      order(column: string, options?: { ascending?: boolean }) {
        const ascending = options?.ascending ?? true;

        filtered.sort((a, b) => {
          const left = a[column];
          const right = b[column];

          if (left === right) return 0;

          if (ascending) {
            return left < right ? -1 : 1;
          }

          return left > right ? -1 : 1;
        });

        return builder;
      },

      limit(count: number) {
        filtered = filtered.slice(0, count);
        return builder;
      },

      async maybeSingle() {
        if (filtered.length === 0) {
          return { data: null, error: null };
        }

        if (filtered.length > 1) {
          return {
            data: null,
            error: new Error("Multiple rows returned"),
          };
        }

        return { data: filtered[0], error: null };
      },

      async single() {
        if (filtered.length === 0) {
          return {
            data: null,
            error: new Error("No rows returned"),
          };
        }

        if (filtered.length > 1) {
          return {
            data: null,
            error: new Error("Multiple rows returned"),
          };
        }

        return { data: filtered[0], error: null };
      },

      then(resolve: (value: { data: any[]; error: null }) => any) {
        return Promise.resolve({
          data: filtered,
          error: null,
        }).then(resolve);
      },

      // --------------------------------------------------------
      // Insert
      // --------------------------------------------------------

      insert(values: any) {
        const valuesToInsert = Array.isArray(values) ? values : [values];

        const insertedRows = valuesToInsert.map((value) => ({
          id: crypto.randomUUID(),
          ...value,
        }));

        rows.push(...insertedRows);

        const insertBuilder: any = {
          select() {
            return insertBuilder;
          },

          async single() {
            return {
              data: insertedRows[0] ?? null,
              error: insertedRows.length > 0 ? null : new Error("No rows inserted"),
            };
          },

          async maybeSingle() {
            return {
              data: insertedRows[0] ?? null,
              error: null,
            };
          },

          then(resolve: (value: { data: any[]; error: null }) => any) {
            return Promise.resolve({
              data: insertedRows,
              error: null,
            }).then(resolve);
          },
        };

        return insertBuilder;
      },

      // --------------------------------------------------------
      // Update
      // --------------------------------------------------------

      update(values: any) {
        let updateFiltered = [...rows];

        const updateBuilder: any = {
          eq(column: string, value: unknown) {
            updateFiltered = updateFiltered.filter(
              (row) => row[column] === value,
            );

            for (const row of updateFiltered) {
              Object.assign(row, values);
            }

            return updateBuilder;
          },

          select() {
            return updateBuilder;
          },

          async single() {
            const row = updateFiltered[0];

            return {
              data: row ?? null,
              error: row ? null : new Error("Not found"),
            };
          },

          async maybeSingle() {
            return {
              data: updateFiltered[0] ?? null,
              error: null,
            };
          },

          then(resolve: (value: { data: any[]; error: null }) => any) {
            return Promise.resolve({
              data: updateFiltered,
              error: null,
            }).then(resolve);
          },
        };

        return updateBuilder;
      },
    };

    return builder;
  };

  // ==========================================================
  // Mock Supabase client
  // ==========================================================

  const supabaseClient = {
    auth: {
      async getUser(token: string) {
        if (token === "student-token") {
          return {
            data: {
              user: {
                id: "student-1",
                email: "student@example.com",
              },
            },
            error: null,
          };
        }

        if (token === "student-2-token") {
          return {
            data: {
              user: {
                id: "student-2",
                email: "student2@example.com",
              },
            },
            error: null,
          };
        }

        if (token === "coordinator-token") {
          return {
            data: {
              user: {
                id: "coordinator-1",
                email: "coordinator@example.com",
              },
            },
            error: null,
          };
        }

        return {
          data: { user: null },
          error: new Error("Invalid token"),
        };
      },
    },

    from(table: keyof typeof data) {
      const rows = data[table] as any[];
      return makeBuilder(table, rows);
    },
  };

  return {
    supabaseClient,

    supabaseAdmin: {
      from(table: keyof typeof data) {
        const rows = data[table] as any[];
        return makeBuilder(table, rows);
      },
    },

    from(table: keyof typeof data) {
      const rows = data[table] as any[];
      return makeBuilder(table, rows);
    },

    auth: supabaseClient.auth,

    // Expose mock data for direct inspection when needed.
    __data: data,
  };
}

// ============================================================
// Test 1 — Create attendance
// ============================================================

Deno.test(
  "POST /attendance - creates attendance and persists audit event",
  async () => {
    const app = createIntegrationApp();
    const attendanceDate = today();

    const response = await app.request("/attendance", {
      method: "POST",
      headers: {
        Authorization: "Bearer student-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        internship_id: INTERNSHIP_ID,
        attendance_date: attendanceDate,
        time_in: "08:00",
        time_out: "17:00",
      }),
    });

    const body = await response.json();

    assertEquals(
      response.status,
      201,
      `Expected attendance creation to succeed. Response: ${
        JSON.stringify(
          body,
        )
      }`,
    );

    assertEquals(body.success, true);
    assertExists(body.data);
    assertExists(body.data.id);
    assertEquals(body.data.internship_id, INTERNSHIP_ID);
    assertEquals(body.data.attendance_date, attendanceDate);
    assertEquals(body.data.time_in, "08:00");
    assertEquals(body.data.time_out, "17:00");
    assertEquals(body.data.validation_status, "pending");

    await assertAuditEvent(
      app.mockSupabase.supabaseAdmin as unknown as SupabaseClient,
      {
        actorId: "student-1",
        action: "CREATE_ATTENDANCE",
        resourceType: "attendance",
        resourceId: body.data.id,
      },
    );
  },
);

// ============================================================
// Test 2 — Invalid request body
// ============================================================

Deno.test("POST /attendance - rejects invalid request body", async () => {
  const app = createIntegrationApp();

  const response = await app.request("/attendance", {
    method: "POST",
    headers: {
      Authorization: "Bearer student-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      internship_id: "invalid",
      attendance_date: "invalid-date",
      time_in: "invalid-time",
      time_out: "invalid-time",
    }),
  });

  assertEquals(response.status, 400);
});

// ============================================================
// Test 3 — Student attendance
// ============================================================

Deno.test("GET /attendance/me - returns student's attendance", async () => {
  const app = createIntegrationApp();

  const response = await app.request("/attendance/me", {
    method: "GET",
    headers: {
      Authorization: "Bearer student-token",
    },
  });

  assertEquals(response.status, 200);

  const body = await response.json();

  assertEquals(body.success, true);
  assertExists(body.data);
  assertEquals(Array.isArray(body.data), true);
  assertEquals(body.data.length, 1);
});

// ============================================================
// Test 4 — Retrieve attendance
// ============================================================

Deno.test("GET /attendance/:id - returns attendance", async () => {
  const app = createIntegrationApp();

  const response = await app.request("/attendance/attendance-1", {
    method: "GET",
    headers: {
      Authorization: "Bearer student-token",
    },
  });

  assertEquals(response.status, 200);

  const body = await response.json();

  assertEquals(body.success, true);
  assertEquals(body.data.id, "attendance-1");
});

// ============================================================
// Test 5 — Missing attendance
// ============================================================

Deno.test(
  "GET /attendance/:id - returns 404 for missing attendance",
  async () => {
    const app = createIntegrationApp();

    const response = await app.request("/attendance/missing-attendance", {
      method: "GET",
      headers: {
        Authorization: "Bearer student-token",
      },
    });

    assertEquals(response.status, 404);

    const body = await response.json();
    assertEquals(body.success, false);
  },
);

// ============================================================
// Test 6 — Internship attendance
// ============================================================

Deno.test(
  "GET /attendance/internship/:id - returns attendance records",
  async () => {
    const app = createIntegrationApp();

    const response = await app.request(
      `/attendance/internship/${INTERNSHIP_ID}`,
      {
        method: "GET",
        headers: {
          Authorization: "Bearer student-token",
        },
      },
    );

    assertEquals(response.status, 200);

    const body = await response.json();

    assertEquals(body.success, true);
    assertEquals(Array.isArray(body.data), true);
  },
);

// ============================================================
// Test 7 — Rendered hours
// ============================================================

Deno.test(
  "GET /attendance/internship/:id/rendered-hours - returns rendered hours",
  async () => {
    const app = createIntegrationApp();

    const response = await app.request(
      `/attendance/internship/${INTERNSHIP_ID}/rendered-hours`,
      {
        method: "GET",
        headers: {
          Authorization: "Bearer student-token",
        },
      },
    );

    assertEquals(response.status, 200);

    const body = await response.json();

    assertEquals(body.success, true);
    assertEquals(body.data.internshipId, INTERNSHIP_ID);

    // The seeded record is pending, so it should not contribute
    // to validated/rendered internship hours.
    assertEquals(body.data.totalHours, 0);
  },
);

Deno.test(
  "GET /attendance/internship/:id - denies another student access to attendance",
  async () => {
    const app = createIntegrationApp();

    const response = await app.request(
      `/attendance/internship/${INTERNSHIP_ID}`,
      {
        method: "GET",
        headers: {
          Authorization: "Bearer student-2-token",
        },
      },
    );

    assertEquals(response.status, 403);

    const body = await response.json();

    assertEquals(body.success, false);
    assertEquals(
      body.message,
      "You can only access attendance for your own internship.",
    );
  },
);

Deno.test(
  "GET /attendance/internship/:id/rendered-hours - denies another student access to rendered hours",
  async () => {
    const app = createIntegrationApp();

    const response = await app.request(
      `/attendance/internship/${INTERNSHIP_ID}/rendered-hours`,
      {
        method: "GET",
        headers: {
          Authorization: "Bearer student-2-token",
        },
      },
    );

    assertEquals(response.status, 403);

    const body = await response.json();

    assertEquals(body.success, false);
    assertEquals(
      body.message,
      "You can only access attendance for your own internship.",
    );
  },
);

Deno.test(
  "GET /attendance/internship/:id - allows an internship coordinator to retrieve attendance",
  async () => {
    const app = createIntegrationApp();

    const response = await app.request(
      `/attendance/internship/${INTERNSHIP_ID}`,
      {
        method: "GET",
        headers: {
          Authorization: "Bearer coordinator-token",
        },
      },
    );

    assertEquals(response.status, 200);

    const body = await response.json();

    assertEquals(body.success, true);
    assertEquals(Array.isArray(body.data), true);
  },
);

// ============================================================
// Test 8 — Update attendance
// ============================================================

Deno.test(
  "PATCH /attendance/:id - updates pending attendance and persists audit event",
  async () => {
    const app = createIntegrationApp();

    const response = await app.request("/attendance/attendance-1", {
      method: "PATCH",
      headers: {
        Authorization: "Bearer student-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        time_in: "09:00",
        time_out: "18:00",
      }),
    });

    const body = await response.json();

    assertEquals(
      response.status,
      200,
      `Expected attendance update to succeed. Response: ${
        JSON.stringify(
          body,
        )
      }`,
    );

    assertEquals(body.success, true);
    assertEquals(body.data.id, "attendance-1");
    assertEquals(body.data.time_in, "09:00");
    assertEquals(body.data.time_out, "18:00");

    await assertAuditEvent(
      app.mockSupabase.supabaseAdmin as unknown as SupabaseClient,
      {
        actorId: "student-1",
        action: "UPDATE_ATTENDANCE",
        resourceType: "attendance",
        resourceId: body.data.id,
      },
    );
  },
);

// ============================================================
// Test 9 — Validation authorization
// ============================================================

Deno.test(
  "PATCH /attendance/:id/validation - rejects student validation attempt",
  async () => {
    const app = createIntegrationApp();

    const response = await app.request("/attendance/attendance-1/validation", {
      method: "PATCH",
      headers: {
        Authorization: "Bearer student-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        validation_status: "validated",
      }),
    });

    assertEquals(response.status, 403);
  },
);

// ============================================================
// Test 10 — Invalid validation status
// ============================================================

Deno.test(
  "PATCH /attendance/:id/validation - rejects invalid status",
  async () => {
    const app = createIntegrationApp();

    const response = await app.request("/attendance/attendance-1/validation", {
      method: "PATCH",
      headers: {
        Authorization: "Bearer coordinator-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        validation_status: "pending",
      }),
    });

    assertEquals(response.status, 400);
  },
);

// ============================================================
// Test 11 — Successful coordinator validation and audit
// ============================================================

Deno.test(
  "PATCH /attendance/:id/validation - coordinator validates attendance and persists audit event",
  async () => {
    const app = createIntegrationApp();

    const response = await app.request("/attendance/attendance-1/validation", {
      method: "PATCH",
      headers: {
        Authorization: "Bearer coordinator-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        validation_status: "validated",
      }),
    });

    const body = await response.json();

    assertEquals(
      response.status,
      200,
      `Expected coordinator validation to succeed. Response: ${
        JSON.stringify(
          body,
        )
      }`,
    );

    assertEquals(body.success, true);
    assertEquals(body.data.id, "attendance-1");
    assertEquals(body.data.validation_status, "validated");
    assertEquals(body.data.validated_by, "coordinator-1");

    await assertAuditEvent(
      app.mockSupabase.supabaseAdmin as unknown as SupabaseClient,
      {
        actorId: "coordinator-1",
        action: "VALIDATE_ATTENDANCE",
        resourceType: "attendance",
        resourceId: body.data.id,
      },
    );
  },
);

// ============================================================
// Test 12 — Successful coordinator rejection and audit
// ============================================================

Deno.test(
  "PATCH /attendance/:id/validation - coordinator rejects attendance and persists audit event",
  async () => {
    const app = createIntegrationApp();

    const response = await app.request("/attendance/attendance-1/validation", {
      method: "PATCH",
      headers: {
        Authorization: "Bearer coordinator-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        validation_status: "rejected",
      }),
    });

    const body = await response.json();

    assertEquals(
      response.status,
      200,
      `Expected coordinator rejection to succeed. Response: ${
        JSON.stringify(
          body,
        )
      }`,
    );

    assertEquals(body.success, true);
    assertEquals(body.data.id, "attendance-1");
    assertEquals(body.data.validation_status, "rejected");

    await assertAuditEvent(
      app.mockSupabase.supabaseAdmin as unknown as SupabaseClient,
      {
        actorId: "coordinator-1",
        action: "REJECT_ATTENDANCE",
        resourceType: "attendance",
        resourceId: body.data.id,
      },
    );
  },
);
