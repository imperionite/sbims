import { assertEquals, assertRejects } from "@std/assert";

import type { SupabaseClients } from "../../../src/lib/supabase.ts";
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

type MockSupabaseOptions = {
  results?: MockQueryResult[];
};

function createMockSupabase(
  options: MockSupabaseOptions = {},
): SupabaseClients {
  const results = options.results ?? [];
  let callIndex = 0;

  const getResult = (): MockQueryResult => {
    const result = results[callIndex++];

    return (
      result ?? {
        data: null,
        error: null,
      }
    );
  };

  const createQuery = () => {
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
        const result = getResult();

        return Promise.resolve({
          data: result.data ?? null,
          error: result.error ?? null,
        });
      },

      single() {
        const result = getResult();

        return Promise.resolve({
          data: result.data ?? null,
          error: result.error ?? null,
        });
      },

      maybeSingle() {
        const result = getResult();

        return Promise.resolve({
          data: result.data ?? null,
          error: result.error ?? null,
        });
      },
    };

    return query;
  };

  const from = () => createQuery();

  const createAuthenticatedClient = (_accessToken: string) => ({
    from,
  } as unknown as SupabaseClients["supabaseClient"]);

  const createPublicClient = () => ({
    from,
  } as unknown as SupabaseClients["supabaseClient"]);

  return {
    supabaseClient: {
      from,
    } as unknown as SupabaseClients["supabaseClient"],

    supabaseAdmin: {
      from,
    } as unknown as SupabaseClients["supabaseAdmin"],

    createAuthenticatedClient,

    createPublicClient,
  };
}

function createService(results: MockQueryResult[] = []) {
  const supabase = createMockSupabase({ results });

  return new HteService(supabase);
}

Deno.test("HteService.listHtes should return HTE profiles", async () => {
  const service = createService([
    {
      data: [mockHte],
    },
  ]);

  const result = await service.listHtes();

  assertEquals(result, [mockHte]);
});

Deno.test("HteService.listHtes should reject Supabase errors", async () => {
  const service = createService([
    {
      error: {
        message: "Database failure",
      },
    },
  ]);

  await assertRejects(
    () => service.listHtes(),
    AppError,
    "Unable to retrieve HTE profiles.",
  );
});

Deno.test("HteService.getHte should return an HTE profile", async () => {
  const service = createService([
    {
      data: mockHte,
    },
  ]);

  const result = await service.getHte(TEST_HTE_ID);

  assertEquals(result, mockHte);
});

Deno.test(
  "HteService.getHte should return 404 when HTE does not exist",
  async () => {
    const service = createService([
      {
        data: null,
      },
    ]);

    await assertRejects(
      () => service.getHte(TEST_HTE_ID),
      AppError,
      "HTE profile not found.",
    );
  },
);

Deno.test("HteService.createHte should create an HTE profile", async () => {
  const service = createService([
    {
      data: mockHte,
    },
  ]);

  const result = await service.createHte({
    companyName: "Test Manufacturing Corporation",
    address: "Test Address, Bulacan",
    contactPerson: "Test Contact",
    contactEmail: "contact@example.com",
    contactNumber: "09171234567",
  });

  assertEquals(result, mockHte);
});

Deno.test(
  "HteService.createHte should accept omitted optional fields",
  async () => {
    const service = createService([
      {
        data: {
          ...mockHte,
          contact_email: null,
          contact_number: null,
        },
      },
    ]);

    const result = await service.createHte({
      companyName: "Test Manufacturing Corporation",
      address: "Test Address, Bulacan",
      contactPerson: "Test Contact",
    });

    assertEquals(result.contact_email, null);
    assertEquals(result.contact_number, null);
  },
);

Deno.test("HteService.updateHte should update supplied fields", async () => {
  const service = createService([
    {
      data: {
        ...mockHte,
        company_name: "Updated Manufacturing Corporation",
        contact_person: "Updated Contact",
      },
    },
  ]);

  const result = await service.updateHte(TEST_HTE_ID, {
    companyName: "Updated Manufacturing Corporation",
    contactPerson: "Updated Contact",
  });

  assertEquals(result.company_name, "Updated Manufacturing Corporation");
  assertEquals(result.contact_person, "Updated Contact");
  assertEquals(result.address, mockHte.address);
});

Deno.test("HteService.updateHte should reject an empty update", async () => {
  const service = createService();

  await assertRejects(
    () => service.updateHte(TEST_HTE_ID, {}),
    AppError,
    "At least one HTE profile field is required.",
  );
});

Deno.test(
  "HteService.updateHte should return 404 when HTE does not exist",
  async () => {
    const service = createService([
      {
        data: null,
      },
    ]);

    await assertRejects(
      () =>
        service.updateHte(TEST_HTE_ID, {
          companyName: "Updated HTE",
        }),
      AppError,
      "HTE profile not found.",
    );
  },
);

Deno.test("HteService.updateStatus should update HTE status", async () => {
  const service = createService([
    {
      data: {
        ...mockHte,
        is_active: false,
      },
    },
  ]);

  const result = await service.updateStatus(TEST_HTE_ID, {
    isActive: false,
  });

  assertEquals(result.is_active, false);
});

Deno.test(
  "HteService.updateStatus should return 404 when HTE does not exist",
  async () => {
    const service = createService([
      {
        data: null,
      },
    ]);

    await assertRejects(
      () =>
        service.updateStatus(TEST_HTE_ID, {
          isActive: false,
        }),
      AppError,
      "HTE profile not found.",
    );
  },
);
