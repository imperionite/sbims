import { assert, assertEquals, assertFalse } from "@std/assert";
import {
  createUserSchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
} from "../../../src/modules/users/users.schema.ts";
import {
  createHTESchema,
  updateHTESupervisorSchema,
} from "../../../src/modules/htes/htes.schema.ts";
import { internshipReportQuerySchema } from "../../../src/modules/reports/reports.schema.ts";
import {
  createEvaluationSchema,
  evaluationResponsesSchema,
  updateEvaluationSchema,
} from "../../../src/modules/evaluations/evaluations.schema.ts";
import { updateMyStudentSchema } from "../../../src/modules/students/students.schema.ts";

Deno.test("user schemas: reject an unrecognized role", () => {
  const result = updateUserRoleSchema.safeParse({ role: "super_admin" });
  assertFalse(result.success);
});

Deno.test("user schemas: reject malformed role-change payloads", () => {
  const parsed = updateUserRoleSchema.safeParse({
    role: "student",
    userId: "not-a-uuid",
  });
  assert(parsed.success);
  if (parsed.success) assertEquals("userId" in parsed.data, false);
  assertFalse(updateUserStatusSchema.safeParse({ isActive: "false" }).success);
});

Deno.test(
  "user creation schema: reject invalid email and short password",
  () => {
    const result = createUserSchema.safeParse({
      email: "not-an-email",
      firstName: "A",
      lastName: "B",
      role: "student",
      password: "short",
    });
    assertFalse(result.success);
  },
);

Deno.test(
  "HTE schemas: reject blank company details and malformed supervisor IDs",
  () => {
    assertFalse(
      createHTESchema.safeParse({
        companyName: " ",
        address: "Address",
        contactPerson: "Contact",
      }).success,
    );
    assertFalse(
      updateHTESupervisorSchema.safeParse({ supervisorId: "not-a-uuid" })
        .success,
    );
  },
);

Deno.test(
  "report query schema: accepts supported filters and rejects invalid UUIDs/statuses",
  () => {
    const valid = internshipReportQuerySchema.safeParse({
      status: "active",
      program: "BSIT",
    });
    assert(valid.success);
    assertFalse(
      internshipReportQuerySchema.safeParse({ status: "archived" }).success,
    );
    assertFalse(
      internshipReportQuerySchema.safeParse({ hte_id: "not-a-uuid" }).success,
    );
  },
);

Deno.test(
  "evaluation schemas: reject out-of-range scores and unknown criteria",
  () => {
    assertFalse(
      evaluationResponsesSchema.safeParse({ criterion_1: 6 }).success,
    );
    assertFalse(
      evaluationResponsesSchema.safeParse({ unapproved_criterion: 5 }).success,
    );
    assertFalse(updateEvaluationSchema.safeParse({}).success);
  },
);

Deno.test(
  "evaluation creation schema: defaults to an empty draft response",
  () => {
    const result = createEvaluationSchema.safeParse({
      internship_id: "8c8f7c7c-8c0b-4a6f-9c77-9d7f7b8c9c10",
    });
    assert(result.success);
    if (result.success) {
      assertEquals(result.data.responses, {});
      assertEquals(result.data.evaluation_type, "hte_supervisor");
    }
  },
);

Deno.test("student self-update schema: strips protected profile fields", () => {
  const result = updateMyStudentSchema.parse({
    address: "Updated address",
    program: "UNAUTHORIZED PROGRAM CHANGE",
    studentNumber: "UNAUTHORIZED NUMBER CHANGE",
    yearLevel: 6,
  });
  assertEquals(result.address, "Updated address");
  assertEquals("program" in result, false);
  assertEquals("studentNumber" in result, false);
  assertEquals("yearLevel" in result, false);
});
