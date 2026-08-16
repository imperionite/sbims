// deno-lint-ignore-file no-explicit-any

import { assertEquals, assertRejects } from "@std/assert";

import { AppError } from "../../../src/errors/app-error.ts";

import { EvaluationService } from "../../../src/modules/evaluations/evaluations.service.ts";

import type { EvaluationRecord } from "../../../src/modules/evaluations/evaluations.types.ts";

const HTE_SUPERVISOR_ID = "11111111-1111-1111-1111-111111111111";

const OTHER_SUPERVISOR_ID = "22222222-2222-2222-2222-222222222222";

const INTERNSHIP_ID = "33333333-3333-3333-3333-333333333333";

const EVALUATION_ID = "44444444-4444-4444-4444-444444444444";

function createEvaluationRecord(
  overrides: Partial<EvaluationRecord> = {},
): EvaluationRecord {
  return {
    id: EVALUATION_ID,
    internship_id: INTERNSHIP_ID,
    evaluator_id: HTE_SUPERVISOR_ID,
    evaluation_type: "hte_supervisor",
    responses: {
      criterion_1: 5,
      criterion_2: 4,
    },
    comments: "Good performance.",
    status: "draft",
    submitted_at: null,
    created_at: "2026-08-16T08:00:00.000Z",
    updated_at: "2026-08-16T08:00:00.000Z",
    ...overrides,
  };
}

function createInternship(supervisorId: string = HTE_SUPERVISOR_ID) {
  return {
    id: INTERNSHIP_ID,
    student_id: "55555555-5555-5555-5555-555555555555",
    hte_id: "66666666-6666-6666-6666-666666666666",
    status: "active",
    hte_profiles: {
      supervisor_id: supervisorId,
    },
  };
}

/**
 * Creates an EvaluationService backed by mocked
 * Supabase admin responses.
 *
 * The existing project uses this dependency-injection
 * approach for AttendanceService unit tests.
 */
function createMockEvaluationService(
  responses: Array<{
    data?: unknown;
    error?: unknown;
  }>,
) {
  let index = 0;

  const mockFrom = (_table: string) => {
    const response = responses[index++];

    if (!response) {
      throw new Error("Unexpected supabaseAdmin.from() call.");
    }

    const result = {
      data: response.data ?? null,
      error: response.error ?? null,
    };

    const builder: any = {
      select: () => builder,
      eq: () => builder,
      insert: () => builder,
      update: () => builder,
      order: () => result,
      single: () => result,
      maybeSingle: () => result,
    };

    return builder;
  };

  const clients = {
    supabaseAdmin: {
      from: mockFrom,
    },
  } as any;

  return new EvaluationService(clients);
}

/*
 * ---------------------------------------------------------
 * CREATE EVALUATION
 * ---------------------------------------------------------
 */

Deno.test(
  "createEvaluation - creates an HTE Supervisor evaluation for an assigned internship",
  async () => {
    const evaluation = createEvaluationRecord();

    const service = createMockEvaluationService([
      {
        data: createInternship(),
      },
      {
        data: null,
      },
      {
        data: evaluation,
      },
    ]);

    const result = await service.createEvaluation(HTE_SUPERVISOR_ID, {
      internship_id: INTERNSHIP_ID,
      responses: {
        criterion_1: 5,
        criterion_2: 4,
      },
      comments: "Good performance.",
    });

    assertEquals(result, evaluation);
    assertEquals(result.evaluation_type, "hte_supervisor");
    assertEquals(result.status, "draft");
    assertEquals(result.evaluator_id, HTE_SUPERVISOR_ID);
  },
);

Deno.test(
  "createEvaluation - rejects evaluation for another HTE supervisor",
  async () => {
    const service = createMockEvaluationService([
      {
        data: createInternship(OTHER_SUPERVISOR_ID),
      },
    ]);

    await assertRejects(
      () =>
        service.createEvaluation(HTE_SUPERVISOR_ID, {
          internship_id: INTERNSHIP_ID,
          responses: {
            criterion_1: 5,
          },
        }),
      AppError,
      "You can only manage evaluations for internships assigned to your HTE.",
    );
  },
);

Deno.test("createEvaluation - rejects missing internship", async () => {
  const service = createMockEvaluationService([
    {
      data: null,
      error: {
        message: "Not found",
      },
    },
  ]);

  await assertRejects(
    () =>
      service.createEvaluation(HTE_SUPERVISOR_ID, {
        internship_id: INTERNSHIP_ID,
        responses: {
          criterion_1: 5,
        },
      }),
    AppError,
    "Failed to verify internship assignment.",
  );
});

Deno.test("createEvaluation - rejects duplicate evaluation", async () => {
  const existing = createEvaluationRecord();

  const service = createMockEvaluationService([
    {
      data: createInternship(),
    },
    {
      data: {
        id: existing.id,
        status: existing.status,
      },
    },
  ]);

  await assertRejects(
    () =>
      service.createEvaluation(HTE_SUPERVISOR_ID, {
        internship_id: INTERNSHIP_ID,
        responses: {
          criterion_1: 5,
        },
      }),
    AppError,
    "An HTE Supervisor evaluation already exists for this internship.",
  );
});

/*
 * ---------------------------------------------------------
 * GET EVALUATION
 * ---------------------------------------------------------
 */

Deno.test("getEvaluationById - allows assigned HTE Supervisor", async () => {
  const evaluation = createEvaluationRecord();

  const service = createMockEvaluationService([
    {
      data: evaluation,
    },
    {
      data: createInternship(),
    },
  ]);

  const result = await service.getEvaluationById(
    EVALUATION_ID,
    HTE_SUPERVISOR_ID,
    "hte_supervisor",
  );

  assertEquals(result, evaluation);
});

Deno.test("getEvaluationById - rejects unrelated HTE Supervisor", async () => {
  const evaluation = createEvaluationRecord();

  const service = createMockEvaluationService([
    {
      data: evaluation,
    },
    {
      data: createInternship(OTHER_SUPERVISOR_ID),
    },
  ]);

  await assertRejects(
    () =>
      service.getEvaluationById(
        EVALUATION_ID,
        HTE_SUPERVISOR_ID,
        "hte_supervisor",
      ),
    AppError,
    "You can only access evaluations for internships assigned to your HTE.",
  );
});

Deno.test("getEvaluationById - rejects missing evaluation", async () => {
  const service = createMockEvaluationService([
    {
      data: null,
    },
  ]);

  await assertRejects(
    () =>
      service.getEvaluationById(
        EVALUATION_ID,
        HTE_SUPERVISOR_ID,
        "hte_supervisor",
      ),
    AppError,
    "Evaluation not found.",
  );
});

/*
 * ---------------------------------------------------------
 * UPDATE EVALUATION
 * ---------------------------------------------------------
 */

Deno.test("updateEvaluation - updates own draft evaluation", async () => {
  const existing = createEvaluationRecord();

  const updated = createEvaluationRecord({
    responses: {
      criterion_1: 5,
      criterion_2: 5,
    },
    comments: "Updated comments.",
  });

  const service = createMockEvaluationService([
    {
      data: existing,
    },
    {
      data: createInternship(),
    },
    {
      data: updated,
    },
  ]);

  const result = await service.updateEvaluation(
    EVALUATION_ID,
    HTE_SUPERVISOR_ID,
    {
      responses: {
        criterion_1: 5,
        criterion_2: 5,
      },
      comments: "Updated comments.",
    },
  );

  assertEquals(result, updated);
  assertEquals(result.status, "draft");
});

Deno.test("updateEvaluation - rejects submitted evaluation", async () => {
  const submitted = createEvaluationRecord({
    status: "submitted",
    submitted_at: "2026-08-16T09:00:00.000Z",
  });

  const service = createMockEvaluationService([
    {
      data: submitted,
    },
    {
      data: createInternship(),
    },
  ]);

  await assertRejects(
    () =>
      service.updateEvaluation(EVALUATION_ID, HTE_SUPERVISOR_ID, {
        comments: "Attempted modification.",
      }),
    AppError,
    "Only draft evaluations can be updated.",
  );
});

/*
 * ---------------------------------------------------------
 * SUBMIT EVALUATION
 * ---------------------------------------------------------
 */

Deno.test("submitEvaluation - submits own draft evaluation", async () => {
  const draft = createEvaluationRecord();

  const submitted = createEvaluationRecord({
    status: "submitted",
    submitted_at: "2026-08-16T09:00:00.000Z",
  });

  const service = createMockEvaluationService([
    {
      data: draft,
    },
    {
      data: createInternship(),
    },
    {
      data: submitted,
    },
  ]);

  const result = await service.submitEvaluation(
    EVALUATION_ID,
    HTE_SUPERVISOR_ID,
  );

  assertEquals(result, submitted);
  assertEquals(result.status, "submitted");
});

Deno.test(
  "submitEvaluation - rejects already submitted evaluation",
  async () => {
    const submitted = createEvaluationRecord({
      status: "submitted",
      submitted_at: "2026-08-16T09:00:00.000Z",
    });

    const service = createMockEvaluationService([
      {
        data: submitted,
      },
      {
        data: createInternship(),
      },
    ]);

    await assertRejects(
      () => service.submitEvaluation(EVALUATION_ID, HTE_SUPERVISOR_ID),
      AppError,
      "Only draft evaluations can be submitted.",
    );
  },
);

Deno.test(
  "submitEvaluation - rejects evaluation without responses",
  async () => {
    const draft = createEvaluationRecord({
      responses: {},
    });

    const service = createMockEvaluationService([
      {
        data: draft,
      },
      {
        data: createInternship(),
      },
    ]);

    await assertRejects(
      () => service.submitEvaluation(EVALUATION_ID, HTE_SUPERVISOR_ID),
      AppError,
      "Evaluation responses are required before submission.",
    );
  },
);
