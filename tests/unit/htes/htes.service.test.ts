import { assertEquals, assertRejects } from "@std/assert";

import { supabaseAdmin } from "../../../src/lib/supabase.ts";
import { AppError } from "../../../src/errors/app-error.ts";

import { HteService } from "../../../src/modules/htes/htes.service.ts";

const TEST_HTE_ID = "11111111-1111-1111-1111-111111111111";

const mockHte = {
  id: TEST_HTE_ID,
  company_name: "Test Manufacturing Corporation",
  address: "Test Address, Bulacan",
  contact_person: "Test Contact",
  contact_email: "contact@example.com",
  contact_number: "09171234567",
  is_active: true,
  supervisor_id: null,
  created_at: "2026-08-10T00:00:00.000Z",
  updated_at: "2026-08-10T00:00:00.000Z",
};

type MockQueryResult = {
  data?: unknown;
  error?: unknown;
};

function mockSupabaseQuery(result: MockQueryResult) {
  return (() => {
    const query = {
      select() {
        return query;
      },

      insert() {
        return query;
      },

      update() {
        return query;
      },

      eq() {
        return query;
      },

      order() {
        // For listHtes, the chain is: from().select().order()
        // Return a result object that will be awaited
        return Promise.resolve({
          data: result.data ?? null,
          error: result.error ?? null,
        });
      },

      single() {
        return Promise.resolve({
          data: result.data ?? null,
          error: result.error ?? null,
        });
      },

      maybeSingle() {
        return Promise.resolve({
          data: result.data ?? null,
          error: result.error ?? null,
        });
      },
    };

    return query;
  }) as unknown as typeof supabaseAdmin.from;
}

Deno.test("HteService.listHtes should return HTE profiles", async () => {
  const service = new HteService();
  const originalFrom = supabaseAdmin.from;

  supabaseAdmin.from = mockSupabaseQuery({
    data: [mockHte],
  });

  try {
    const result = await service.listHtes();

    assertEquals(result, [mockHte]);
  } finally {
    supabaseAdmin.from = originalFrom;
  }
});

Deno.test("HteService.listHtes should reject Supabase errors", async () => {
  const service = new HteService();
  const originalFrom = supabaseAdmin.from;

  supabaseAdmin.from = mockSupabaseQuery({
    error: { message: "Database failure" },
  });

  try {
    await assertRejects(
      () => service.listHtes(),
      AppError,
      "Unable to retrieve HTE profiles.",
    );
  } finally {
    supabaseAdmin.from = originalFrom;
  }
});

Deno.test("HteService.getHte should return an HTE profile", async () => {
  const service = new HteService();
  const originalFrom = supabaseAdmin.from;

  supabaseAdmin.from = mockSupabaseQuery({
    data: mockHte,
  });

  try {
    const result = await service.getHte(TEST_HTE_ID);

    assertEquals(result, mockHte);
  } finally {
    supabaseAdmin.from = originalFrom;
  }
});

Deno.test(
  "HteService.getHte should return 404 when HTE does not exist",
  async () => {
    const service = new HteService();
    const originalFrom = supabaseAdmin.from;

    supabaseAdmin.from = mockSupabaseQuery({
      data: null,
    });

    try {
      await assertRejects(
        () => service.getHte(TEST_HTE_ID),
        AppError,
        "HTE profile not found.",
      );
    } finally {
      supabaseAdmin.from = originalFrom;
    }
  },
);

Deno.test("HteService.createHte should create an HTE profile", async () => {
  const service = new HteService();
  const originalFrom = supabaseAdmin.from;

  supabaseAdmin.from = mockSupabaseQuery({
    data: mockHte,
  });

  try {
    const result = await service.createHte({
      companyName: "Test Manufacturing Corporation",
      address: "Test Address, Bulacan",
      contactPerson: "Test Contact",
      contactEmail: "contact@example.com",
      contactNumber: "09171234567",
    });

    assertEquals(result, mockHte);
  } finally {
    supabaseAdmin.from = originalFrom;
  }
});

Deno.test(
  "HteService.createHte should accept omitted optional fields",
  async () => {
    const service = new HteService();
    const originalFrom = supabaseAdmin.from;

    supabaseAdmin.from = mockSupabaseQuery({
      data: {
        ...mockHte,
        contact_email: null,
        contact_number: null,
      },
    });

    try {
      const result = await service.createHte({
        companyName: "Test Manufacturing Corporation",
        address: "Test Address, Bulacan",
        contactPerson: "Test Contact",
      });

      assertEquals(result.contact_email, null);
      assertEquals(result.contact_number, null);
    } finally {
      supabaseAdmin.from = originalFrom;
    }
  },
);

Deno.test("HteService.updateHte should update supplied fields", async () => {
  const service = new HteService();
  const originalFrom = supabaseAdmin.from;

  supabaseAdmin.from = mockSupabaseQuery({
    data: {
      ...mockHte,
      company_name: "Updated Manufacturing Corporation",
      contact_person: "Updated Contact",
    },
  });

  try {
    const result = await service.updateHte(TEST_HTE_ID, {
      companyName: "Updated Manufacturing Corporation",
      contactPerson: "Updated Contact",
    });

    assertEquals(result.company_name, "Updated Manufacturing Corporation");
    assertEquals(result.contact_person, "Updated Contact");
    assertEquals(result.address, mockHte.address);
  } finally {
    supabaseAdmin.from = originalFrom;
  }
});

Deno.test("HteService.updateHte should reject an empty update", async () => {
  const service = new HteService();

  await assertRejects(
    () => service.updateHte(TEST_HTE_ID, {}),
    AppError,
    "At least one HTE profile field is required.",
  );
});

Deno.test(
  "HteService.updateHte should return 404 when HTE does not exist",
  async () => {
    const service = new HteService();
    const originalFrom = supabaseAdmin.from;

    supabaseAdmin.from = mockSupabaseQuery({
      data: null,
    });

    try {
      await assertRejects(
        () =>
          service.updateHte(TEST_HTE_ID, {
            companyName: "Updated HTE",
          }),
        AppError,
        "HTE profile not found.",
      );
    } finally {
      supabaseAdmin.from = originalFrom;
    }
  },
);

Deno.test("HteService.updateStatus should update HTE status", async () => {
  const service = new HteService();
  const originalFrom = supabaseAdmin.from;

  supabaseAdmin.from = mockSupabaseQuery({
    data: {
      ...mockHte,
      is_active: false,
    },
  });

  try {
    const result = await service.updateStatus(TEST_HTE_ID, {
      isActive: false,
    });

    assertEquals(result.is_active, false);
  } finally {
    supabaseAdmin.from = originalFrom;
  }
});

Deno.test(
  "HteService.updateStatus should return 404 when HTE does not exist",
  async () => {
    const service = new HteService();
    const originalFrom = supabaseAdmin.from;

    supabaseAdmin.from = mockSupabaseQuery({
      data: null,
    });

    try {
      await assertRejects(
        () =>
          service.updateStatus(TEST_HTE_ID, {
            isActive: false,
          }),
        AppError,
        "HTE profile not found.",
      );
    } finally {
      supabaseAdmin.from = originalFrom;
    }
  },
);
