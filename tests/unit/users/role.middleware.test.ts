import { assertEquals } from "@std/assert";
import { Hono } from "hono";

import { requireRole } from "../../../src/modules/auth/role.middleware.ts";
import { supabaseAdmin } from "../../../src/lib/supabase.ts";

const testUserId = "11111111-1111-1111-1111-111111111111";

function createApp() {
  const app = new Hono<{
    Variables: {
      user: {
        id: string;
        email?: string;
      };
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
    c.set("user", {
      id: testUserId,
      email: "test@sbims.com",
    });

    await next();
  });

  return app;
}

function mockSupabaseRole(role: string | null, error: unknown = null) {
  return (() => ({
    select() {
      return this;
    },

    eq() {
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

async function requestWithRole(role: string | null, error: unknown = null) {
  const originalFrom = supabaseAdmin.from;

  supabaseAdmin.from = mockSupabaseRole(role, error);

  try {
    const app = createApp();

    app.get("/", requireRole("administrator"), (c) =>
      c.json({
        success: true,
      }));

    return await app.request("/");
  } finally {
    supabaseAdmin.from = originalFrom;
  }
}

Deno.test("requireRole allows administrator access", async () => {
  const response = await requestWithRole("administrator");

  assertEquals(response.status, 200);
});

Deno.test("requireRole rejects unauthorized role", async () => {
  const response = await requestWithRole("student");

  assertEquals(response.status, 403);
});

Deno.test("requireRole rejects missing profile", async () => {
  const response = await requestWithRole(null, {
    message: "not found",
  });

  assertEquals(response.status, 404);
});
