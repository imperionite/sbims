import { assertEquals } from "@std/assert";
import { Hono } from "hono";

import type { SupabaseClients } from "../../../src/lib/supabase.ts";
import type { AppVariables } from "../../../src/types/context.ts";

import { AuthRole } from "../../../src/modules/auth/auth.types.ts";
import { requireRole } from "../../../src/modules/auth/role.middleware.ts";

const testUserId = "11111111-1111-1111-1111-111111111111";

type TestUser = {
  id: string;
  email?: string;
};

type MockRoleOptions = {
  role?: AuthRole | null;
  profileError?: unknown;
  capturedUserId?: {
    value: string | null;
  };
};

function createMockSupabase({
  role = null,
  profileError = null,
  capturedUserId,
}: MockRoleOptions = {}): SupabaseClients {
  const query = {
    select() {
      return query;
    },

    eq(column: string, value: string) {
      if (column === "id" && capturedUserId) {
        capturedUserId.value = value;
      }

      return query;
    },

    single() {
      return Promise.resolve({
        data: role ? { role } : null,
        error: profileError,
      });
    },
  };

  return {
    supabaseClient: {} as SupabaseClients["supabaseClient"],

    supabaseAdmin: {
      from() {
        return query;
      },
    } as unknown as SupabaseClients["supabaseAdmin"],

    createAuthenticatedClient: () => ({}) as SupabaseClients["supabaseClient"],

    createPublicClient: () => ({}) as SupabaseClients["supabaseClient"],
  };
}

function createApp(
  supabase: SupabaseClients,
  user: TestUser | null = {
    id: testUserId,
    email: "test@sbims.com",
  },
) {
  const app = new Hono<{
    Variables: AppVariables;
  }>();

  app.onError((error, c) => {
    if ("status" in error) {
      return c.json(
        {
          message: error.message,
        },
        error.status as 400 | 401 | 403 | 404 | 500,
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
    c.set("supabase", supabase);

    if (user !== null) {
      c.set("user", user);
    }

    await next();
  });

  return app;
}

async function requestWithRole(
  actualRole: AuthRole | null,
  requiredRole: AuthRole = "administrator",
  options: {
    user?: TestUser | null;
    profileError?: unknown;
  } = {},
) {
  const capturedUserId = {
    value: null as string | null,
  };

  const supabase = createMockSupabase({
    role: actualRole,
    profileError: options.profileError,
    capturedUserId,
  });

  const app = createApp(
    supabase,
    options.user === undefined
      ? {
        id: testUserId,
        email: "test@sbims.com",
      }
      : options.user,
  );

  let handlerCalled = false;

  app.get("/", requireRole(requiredRole), (c) => {
    handlerCalled = true;

    return c.json({
      success: true,
    });
  });

  const response = await app.request("/");

  return {
    response,
    handlerCalled,
    queriedUserId: capturedUserId.value,
  };
}

Deno.test(
  "requireRole rejects request without authenticated user",
  async () => {
    const result = await requestWithRole("administrator", "administrator", {
      user: null,
    });

    assertEquals(result.response.status, 401);
    assertEquals(result.handlerCalled, false);
    assertEquals(result.queriedUserId, null);
  },
);

Deno.test("requireRole allows user with matching role", async () => {
  const result = await requestWithRole("administrator");

  assertEquals(result.response.status, 200);
  assertEquals(result.handlerCalled, true);
});

Deno.test("requireRole rejects user with different role", async () => {
  const result = await requestWithRole("student");

  assertEquals(result.response.status, 403);
  assertEquals(result.handlerCalled, false);
});

Deno.test("requireRole rejects user when profile does not exist", async () => {
  const result = await requestWithRole(null);

  assertEquals(result.response.status, 404);
  assertEquals(result.handlerCalled, false);
});

Deno.test(
  "requireRole uses the authenticated user's id for role lookup",
  async () => {
    const user = {
      id: "22222222-2222-2222-2222-222222222222",
      email: "another@sbims.com",
    };

    const result = await requestWithRole("administrator", "administrator", {
      user,
    });

    assertEquals(result.response.status, 200);
    assertEquals(result.queriedUserId, user.id);
  },
);

Deno.test("requireRole allows every defined authentication role", async () => {
  const roles: AuthRole[] = [
    "administrator",
    "internship_coordinator",
    "faculty_adviser",
    "student",
    "hte_supervisor",
  ];

  for (const role of roles) {
    const result = await requestWithRole(role, role);

    assertEquals(result.response.status, 200);
    assertEquals(result.handlerCalled, true);
  }
});

Deno.test(
  "requireRole rejects the authenticated user when role does not match",
  async () => {
    const result = await requestWithRole("student", "faculty_adviser");

    assertEquals(result.response.status, 403);
    assertEquals(result.handlerCalled, false);
    assertEquals(result.queriedUserId, testUserId);
  },
);

Deno.test(
  "requireRole sets the authenticated user's role in context",
  async () => {
    const supabase = createMockSupabase({
      role: "administrator",
    });

    const app = createApp(supabase);

    app.get("/", requireRole("administrator"), (c) => {
      return c.json({
        role: c.get("userRole"),
      });
    });

    const response = await app.request("/");

    assertEquals(response.status, 200);
    assertEquals(await response.json(), {
      role: "administrator",
    });
  },
);

Deno.test(
  "requireRole does not execute protected handler when unauthorized",
  async () => {
    const result = await requestWithRole("student", "administrator");

    assertEquals(result.response.status, 403);
    assertEquals(result.handlerCalled, false);
  },
);
