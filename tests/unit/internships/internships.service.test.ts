import { assertEquals, assertRejects } from "@std/assert";

import { supabaseAdmin } from "../../../src/lib/supabase.ts";
import { AppError } from "../../../src/errors/app-error.ts";

import { InternshipService } from "../../../src/modules/internships/internships.service.ts";

const TEST_INTERNSHIP_ID = "11111111-1111-1111-1111-111111111111";

const TEST_STUDENT_ID = "22222222-2222-2222-2222-222222222222";

const TEST_HTE_ID = "33333333-3333-3333-3333-333333333333";

const TEST_NEW_HTE_ID = "44444444-4444-4444-4444-444444444444";

const mockInternship = {
  id: TEST_INTERNSHIP_ID,
  student_id: TEST_STUDENT_ID,
  hte_id: TEST_HTE_ID,
  faculty_adviser_id: null,
  required_hours: null,
  status: "pending",
  created_at: "2026-08-10T00:00:00.000Z",
  updated_at: "2026-08-10T00:00:00.000Z",
  student_profiles: [
    {
      id: TEST_STUDENT_ID,
      student_number: "2026-00001",
      program: "BSIT",
      year_level: 4,
      section: "A",
    },
  ],
  hte_profiles: [
    {
      id: TEST_HTE_ID,
      company_name: "Test Manufacturing Corporation",
      contact_person: "Test Contact",
      contact_email: "contact@example.com",
      is_active: true,
    },
  ],
};

type MockQueryResult = {
  data?: unknown;
  error?: unknown;
};

function createQuery(result: MockQueryResult) {
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
}

function mockSupabaseQueries(results: MockQueryResult[]) {
  let callIndex = 0;

  return (() => {
    const result = results[callIndex++] ?? {
      data: null,
      error: null,
    };

    return createQuery(result);
  }) as unknown as typeof supabaseAdmin.from;
}

Deno.test(
  "InternshipService.listInternships should return internship records",
  async () => {
    const service = new InternshipService();
    const originalFrom = supabaseAdmin.from;

    supabaseAdmin.from = mockSupabaseQueries([
      {
        data: [mockInternship],
      },
    ]);

    try {
      const result = await service.listInternships();

      assertEquals(result, [mockInternship]);
    } finally {
      supabaseAdmin.from = originalFrom;
    }
  },
);

Deno.test(
  "InternshipService.listInternships should reject Supabase errors",
  async () => {
    const service = new InternshipService();
    const originalFrom = supabaseAdmin.from;

    supabaseAdmin.from = mockSupabaseQueries([
      {
        error: {
          message: "Database failure",
        },
      },
    ]);

    try {
      await assertRejects(
        () => service.listInternships(),
        AppError,
        "Unable to retrieve internships.",
      );
    } finally {
      supabaseAdmin.from = originalFrom;
    }
  },
);

Deno.test(
  "InternshipService.getInternship should return an internship",
  async () => {
    const service = new InternshipService();
    const originalFrom = supabaseAdmin.from;

    supabaseAdmin.from = mockSupabaseQueries([
      {
        data: mockInternship,
      },
    ]);

    try {
      const result = await service.getInternship(TEST_INTERNSHIP_ID);

      assertEquals(result, mockInternship);
    } finally {
      supabaseAdmin.from = originalFrom;
    }
  },
);

Deno.test(
  "InternshipService.getInternship should return 404 when internship does not exist",
  async () => {
    const service = new InternshipService();
    const originalFrom = supabaseAdmin.from;

    supabaseAdmin.from = mockSupabaseQueries([
      {
        data: null,
      },
    ]);

    try {
      await assertRejects(
        () => service.getInternship(TEST_INTERNSHIP_ID),
        AppError,
        "Internship not found.",
      );
    } finally {
      supabaseAdmin.from = originalFrom;
    }
  },
);

Deno.test(
  "InternshipService.getMyInternship should return the student's internship",
  async () => {
    const service = new InternshipService();
    const originalFrom = supabaseAdmin.from;

    supabaseAdmin.from = mockSupabaseQueries([
      {
        data: mockInternship,
      },
    ]);

    try {
      const result = await service.getMyInternship(TEST_STUDENT_ID);

      assertEquals(result, mockInternship);
    } finally {
      supabaseAdmin.from = originalFrom;
    }
  },
);

Deno.test(
  "InternshipService.getMyInternship should return 404 when no assignment exists",
  async () => {
    const service = new InternshipService();
    const originalFrom = supabaseAdmin.from;

    supabaseAdmin.from = mockSupabaseQueries([
      {
        data: null,
      },
    ]);

    try {
      await assertRejects(
        () => service.getMyInternship(TEST_STUDENT_ID),
        AppError,
        "No internship assignment found.",
      );
    } finally {
      supabaseAdmin.from = originalFrom;
    }
  },
);

Deno.test(
  "InternshipService.createInternship should create an internship assignment",
  async () => {
    const service = new InternshipService();
    const originalFrom = supabaseAdmin.from;

    supabaseAdmin.from = mockSupabaseQueries([
      {
        data: {
          id: TEST_STUDENT_ID,
          profiles: {
            is_active: true,
          },
        },
      },
      {
        data: {
          id: TEST_HTE_ID,
          is_active: true,
        },
      },
      {
        data: null,
      },
      {
        data: mockInternship,
      },
    ]);

    try {
      const result = await service.createInternship({
        studentId: TEST_STUDENT_ID,
        hteId: TEST_HTE_ID,
      });

      assertEquals(result, mockInternship);
    } finally {
      supabaseAdmin.from = originalFrom;
    }
  },
);

Deno.test(
  "InternshipService.createInternship should reject a missing student",
  async () => {
    const service = new InternshipService();
    const originalFrom = supabaseAdmin.from;

    supabaseAdmin.from = mockSupabaseQueries([
      {
        data: null,
      },
    ]);

    try {
      await assertRejects(
        () =>
          service.createInternship({
            studentId: TEST_STUDENT_ID,
            hteId: TEST_HTE_ID,
          }),
        AppError,
        "Student not found.",
      );
    } finally {
      supabaseAdmin.from = originalFrom;
    }
  },
);

Deno.test(
  "InternshipService.createInternship should reject an inactive student",
  async () => {
    const service = new InternshipService();
    const originalFrom = supabaseAdmin.from;

    supabaseAdmin.from = mockSupabaseQueries([
      {
        data: {
          id: TEST_STUDENT_ID,
          profiles: {
            is_active: false,
          },
        },
      },
    ]);

    try {
      await assertRejects(
        () =>
          service.createInternship({
            studentId: TEST_STUDENT_ID,
            hteId: TEST_HTE_ID,
          }),
        AppError,
        "The selected student account is inactive.",
      );
    } finally {
      supabaseAdmin.from = originalFrom;
    }
  },
);

Deno.test(
  "InternshipService.createInternship should reject a missing HTE",
  async () => {
    const service = new InternshipService();
    const originalFrom = supabaseAdmin.from;

    supabaseAdmin.from = mockSupabaseQueries([
      {
        data: {
          id: TEST_STUDENT_ID,
          profiles: {
            is_active: true,
          },
        },
      },
      {
        data: null,
      },
    ]);

    try {
      await assertRejects(
        () =>
          service.createInternship({
            studentId: TEST_STUDENT_ID,
            hteId: TEST_HTE_ID,
          }),
        AppError,
        "HTE not found.",
      );
    } finally {
      supabaseAdmin.from = originalFrom;
    }
  },
);

Deno.test(
  "InternshipService.createInternship should reject an inactive HTE",
  async () => {
    const service = new InternshipService();
    const originalFrom = supabaseAdmin.from;

    supabaseAdmin.from = mockSupabaseQueries([
      {
        data: {
          id: TEST_STUDENT_ID,
          profiles: {
            is_active: true,
          },
        },
      },
      {
        data: {
          id: TEST_HTE_ID,
          is_active: false,
        },
      },
    ]);

    try {
      await assertRejects(
        () =>
          service.createInternship({
            studentId: TEST_STUDENT_ID,
            hteId: TEST_HTE_ID,
          }),
        AppError,
        "The selected HTE is inactive.",
      );
    } finally {
      supabaseAdmin.from = originalFrom;
    }
  },
);

Deno.test(
  "InternshipService.createInternship should reject a duplicate student assignment",
  async () => {
    const service = new InternshipService();
    const originalFrom = supabaseAdmin.from;

    supabaseAdmin.from = mockSupabaseQueries([
      {
        data: {
          id: TEST_STUDENT_ID,
          profiles: {
            is_active: true,
          },
        },
      },
      {
        data: {
          id: TEST_HTE_ID,
          is_active: true,
        },
      },
      {
        data: {
          id: TEST_INTERNSHIP_ID,
        },
      },
    ]);

    try {
      await assertRejects(
        () =>
          service.createInternship({
            studentId: TEST_STUDENT_ID,
            hteId: TEST_HTE_ID,
          }),
        AppError,
        "The student already has an internship assignment.",
      );
    } finally {
      supabaseAdmin.from = originalFrom;
    }
  },
);

Deno.test(
  "InternshipService.updateStatus should transition pending to active",
  async () => {
    const service = new InternshipService();
    const originalFrom = supabaseAdmin.from;

    supabaseAdmin.from = mockSupabaseQueries([
      {
        data: {
          id: TEST_INTERNSHIP_ID,
          status: "pending",
        },
      },
      {
        data: {
          ...mockInternship,
          status: "active",
        },
      },
    ]);

    try {
      const result = await service.updateStatus(TEST_INTERNSHIP_ID, "active");

      assertEquals(result.status, "active");
    } finally {
      supabaseAdmin.from = originalFrom;
    }
  },
);

Deno.test(
  "InternshipService.updateStatus should transition active to completed",
  async () => {
    const service = new InternshipService();
    const originalFrom = supabaseAdmin.from;

    supabaseAdmin.from = mockSupabaseQueries([
      {
        data: {
          id: TEST_INTERNSHIP_ID,
          status: "active",
        },
      },
      {
        data: {
          ...mockInternship,
          status: "completed",
        },
      },
    ]);

    try {
      const result = await service.updateStatus(
        TEST_INTERNSHIP_ID,
        "completed",
      );

      assertEquals(result.status, "completed");
    } finally {
      supabaseAdmin.from = originalFrom;
    }
  },
);

Deno.test(
  "InternshipService.updateStatus should reject an invalid transition",
  async () => {
    const service = new InternshipService();
    const originalFrom = supabaseAdmin.from;

    supabaseAdmin.from = mockSupabaseQueries([
      {
        data: {
          id: TEST_INTERNSHIP_ID,
          status: "pending",
        },
      },
    ]);

    try {
      await assertRejects(
        () => service.updateStatus(TEST_INTERNSHIP_ID, "completed"),
        AppError,
        'Invalid internship status transition from "pending" to "completed".',
      );
    } finally {
      supabaseAdmin.from = originalFrom;
    }
  },
);

Deno.test(
  "InternshipService.updateStatus should reject an unchanged status",
  async () => {
    const service = new InternshipService();
    const originalFrom = supabaseAdmin.from;

    supabaseAdmin.from = mockSupabaseQueries([
      {
        data: {
          id: TEST_INTERNSHIP_ID,
          status: "pending",
        },
      },
    ]);

    try {
      await assertRejects(
        () => service.updateStatus(TEST_INTERNSHIP_ID, "pending"),
        AppError,
        'Invalid internship status transition from "pending" to "pending".',
      );
    } finally {
      supabaseAdmin.from = originalFrom;
    }
  },
);

Deno.test(
  "InternshipService.updateStatus should return 404 when internship does not exist",
  async () => {
    const service = new InternshipService();
    const originalFrom = supabaseAdmin.from;

    supabaseAdmin.from = mockSupabaseQueries([
      {
        data: null,
      },
    ]);

    try {
      await assertRejects(
        () => service.updateStatus(TEST_INTERNSHIP_ID, "active"),
        AppError,
        "Internship not found.",
      );
    } finally {
      supabaseAdmin.from = originalFrom;
    }
  },
);

/*
 * ---------------------------------------------------------
 * Update Internship
 * ---------------------------------------------------------
 */

Deno.test(
  "InternshipService.updateInternship should update required hours",
  async () => {
    const service = new InternshipService();
    const originalFrom = supabaseAdmin.from;

    const updatedInternship = {
      ...mockInternship,
      required_hours: 486,
    };

    supabaseAdmin.from = mockSupabaseQueries([
      {
        data: updatedInternship,
      },
    ]);

    try {
      const result = await service.updateInternship(TEST_INTERNSHIP_ID, {
        requiredHours: 486,
      });

      assertEquals(result, updatedInternship);
    } finally {
      supabaseAdmin.from = originalFrom;
    }
  },
);

Deno.test(
  "InternshipService.updateInternship should update HTE assignment",
  async () => {
    const service = new InternshipService();
    const originalFrom = supabaseAdmin.from;

    const updatedInternship = {
      ...mockInternship,
      hte_id: TEST_NEW_HTE_ID,
      hte_profiles: [
        {
          ...mockInternship.hte_profiles[0],
          id: TEST_NEW_HTE_ID,
        },
      ],
    };

    supabaseAdmin.from = mockSupabaseQueries([
      {
        data: {
          id: TEST_NEW_HTE_ID,
          is_active: true,
        },
      },
      {
        data: updatedInternship,
      },
    ]);

    try {
      const result = await service.updateInternship(TEST_INTERNSHIP_ID, {
        hteId: TEST_NEW_HTE_ID,
      });

      assertEquals(result, updatedInternship);
    } finally {
      supabaseAdmin.from = originalFrom;
    }
  },
);

Deno.test(
  "InternshipService.updateInternship should return 404 when internship does not exist",
  async () => {
    const service = new InternshipService();
    const originalFrom = supabaseAdmin.from;

    supabaseAdmin.from = mockSupabaseQueries([
      {
        data: null,
      },
    ]);

    try {
      await assertRejects(
        () =>
          service.updateInternship(TEST_INTERNSHIP_ID, {
            requiredHours: 486,
          }),
        AppError,
        "Internship not found.",
      );
    } finally {
      supabaseAdmin.from = originalFrom;
    }
  },
);
