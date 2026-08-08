import { assertEquals } from "@std/assert";
import { Hono } from "hono";

import { requireRole } from "../../../src/modules/auth/role.middleware.ts";
import { supabaseAdmin } from "../../../src/lib/supabase.ts";
import { AuthRole } from "../../../src/modules/auth/auth.types.ts";

const testUserId = "11111111-1111-1111-1111-111111111111";

type TestUser = {
  id: string;
  email?: string;
};

type MockRoleOptions = {
  role?: string | null;
  error?: unknown;
  capturedUserId?: { value: string | null };
};

function createApp(
  user: TestUser = {
    id: testUserId,
    email: "[test@sbims.com](mailto:test@sbims.com)",
  },
) {
  const app = new Hono<{
    Variables: {
      user: TestUser;
      userRole: string;
    };
  }>();

  app.onError((err, c) => {
    if ("status" in err) {
      return c.json(
        {
          message: err.message,
        },
        err.status as 400 | 401 | 403 | 404 | 500,
      );
    }

    return c.json(
      {
        message: "Internal server error",
      },
      500,
    );
  });

  app.use("*", async (c, next) => {
    c.set("user", user);
    await next();
  });

  return app;
}

function mockSupabaseRole({
  role = null,
  error = null,
  capturedUserId,
}: MockRoleOptions = {}) {
  return (() => ({
    select() {
      return this;
    },

    eq(column: string, value: string) {
      if (column === "id" && capturedUserId) {
        capturedUserId.value = value;
      }

      return this;
    },

    single() {
      return Promise.resolve({
        data: role ? { role } : null,
        error,
      });
    },
  })) as unknown as typeof supabaseAdmin.from;
}

async function requestWithRole(
  actualRole: string | null,
  requiredRole: AuthRole = "administrator",
  error: unknown = null,
) {
  const originalFrom = supabaseAdmin.from;

  const capturedUserId = {
    value: null as string | null,
  };

  supabaseAdmin.from = mockSupabaseRole({
    role: actualRole,
    error,
    capturedUserId,
  });

  try {
    const app = createApp();

    let nextCalled = false;

    // deno-lint-ignore require-await
    app.get("/", requireRole(requiredRole), async (c) => {
      nextCalled = true;

      return c.json({
        success: true,
      });
    });

    const response = await app.request("/");

    return {
      response,
      nextCalled,
      queriedUserId: capturedUserId.value,
    };
  } finally {
    supabaseAdmin.from = originalFrom;
  }
}

Deno.test("requireRole allows user with matching role", async () => {
  const result = await requestWithRole("administrator");

  assertEquals(result.response.status, 200);
  assertEquals(result.nextCalled, true);
});

Deno.test("requireRole rejects user with different role", async () => {
  const result = await requestWithRole("student");

  assertEquals(result.response.status, 403);
  assertEquals(result.nextCalled, false);
});

Deno.test("requireRole rejects user when profile does not exist", async () => {
  const result = await requestWithRole(null, "administrator", null);

  assertEquals(result.response.status, 404);
  assertEquals(result.nextCalled, false);
});

Deno.test("requireRole queries the authenticated user's id", async () => {
  const result = await requestWithRole("administrator");

  assertEquals(result.queriedUserId, testUserId);
});

Deno.test("requireRole supports different required roles", async () => {
  const roles: AuthRole[] = [
    "administrator",
    "internship_coordinator",
    "faculty_adviser",
    "student",
  ];

  for (const role of roles) {
    const result = await requestWithRole(role, role);

    assertEquals(result.response.status, 200);
    assertEquals(result.nextCalled, true);
  }
});

Deno.test(
  "requireRole rejects the same user when role does not match",
  async () => {
    const result = await requestWithRole("student", "faculty_adviser");

    assertEquals(result.response.status, 403);
    assertEquals(result.nextCalled, false);
    assertEquals(result.queriedUserId, testUserId);
  },
);

Deno.test(
  "requireRole does not execute protected handler when unauthorized",
  async () => {
    const originalFrom = supabaseAdmin.from;

    supabaseAdmin.from = mockSupabaseRole({
      role: "student",
    });

    try {
      const app = createApp();

      let protectedHandlerCalled = false;

      app.get("/", requireRole("administrator"), (c) => {
        protectedHandlerCalled = true;

        return c.json({
          success: true,
        });
      });

      const response = await app.request("/");

      assertEquals(response.status, 403);
      assertEquals(protectedHandlerCalled, false);
    } finally {
      supabaseAdmin.from = originalFrom;
    }
  },
);

Deno.test("requireRole allows protected handler when authorized", async () => {
  const originalFrom = supabaseAdmin.from;

  supabaseAdmin.from = mockSupabaseRole({
    role: "administrator",
  });

  try {
    const app = createApp();

    let protectedHandlerCalled = false;

    app.get("/", requireRole("administrator"), (c) => {
      protectedHandlerCalled = true;

      return c.json({
        success: true,
      });
    });

    const response = await app.request("/");

    assertEquals(response.status, 200);
    assertEquals(protectedHandlerCalled, true);
  } finally {
    supabaseAdmin.from = originalFrom;
  }
});
