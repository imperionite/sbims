// deno-lint-ignore-file no-explicit-any
import { assertEquals, assertThrows } from "@std/assert";

import { AppError } from "../../../src/errors/app-error.ts";

import {
  AttendanceService,
  calculateRenderedHours,
} from "../../../src/modules/attendance/attendance.service.ts";

import type { AttendanceRecord } from "../../../src/modules/attendance/attendance.types.ts";

const STUDENT_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_STUDENT_ID = "22222222-2222-2222-2222-222222222222";
const COORDINATOR_ID = "33333333-3333-3333-3333-333333333333";
const INTERNSHIP_ID = "44444444-4444-4444-4444-444444444444";
const ATTENDANCE_ID = "55555555-5555-5555-5555-555555555555";

function createAttendanceRecord(
  overrides: Partial<AttendanceRecord> = {},
): AttendanceRecord {
  return {
    id: ATTENDANCE_ID,
    internship_id: INTERNSHIP_ID,
    attendance_date: "2026-08-12",
    time_in: "08:00:00",
    time_out: "17:00:00",
    validation_status: "pending",
    validated_by: null,
    validated_at: null,
    created_at: "2026-08-12T08:00:00.000Z",
    updated_at: "2026-08-12T08:00:00.000Z",
    ...overrides,
  };
}

/**
 * Creates an AttendanceService instance backed by a mocked
 * Supabase admin client.
 *
 * The service uses dependency injection through SupabaseClients,
 * so the unit tests do not need real Supabase credentials,
 * environment variables, network access, or database state.
 */
function createMockAttendanceService(
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

      neq: () => builder,

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

  return new AttendanceService(clients);
}

/*
 * ---------------------------------------------------------
 * CALCULATED RENDERED HOURS
 * ---------------------------------------------------------
 */

Deno.test(
  "calculateRenderedHours - calculates rendered hours after one-hour break",
  () => {
    assertEquals(calculateRenderedHours("08:00:00", "17:00:00"), 8);

    assertEquals(calculateRenderedHours("08:00:00", "13:00:00"), 4);

    assertEquals(calculateRenderedHours("08:00:00", "12:00:00"), 3);
  },
);

Deno.test("calculateRenderedHours - rejects time-out equal to time-in", () => {
  assertThrows(
    () => calculateRenderedHours("08:00:00", "08:00:00"),
    AppError,
    "Time-out must be later than time-in.",
  );
});

Deno.test(
  "calculateRenderedHours - rejects time-out earlier than time-in",
  () => {
    assertThrows(
      () => calculateRenderedHours("17:00:00", "08:00:00"),
      AppError,
      "Time-out must be later than time-in.",
    );
  },
);

Deno.test(
  "calculateRenderedHours - rejects duration that is too short for the break",
  () => {
    assertThrows(
      () => calculateRenderedHours("08:00:00", "09:00:00"),
      AppError,
      "Attendance duration is too short for the standard one-hour break.",
    );
  },
);

/*
 * ---------------------------------------------------------
 * CREATE ATTENDANCE
 * ---------------------------------------------------------
 */

Deno.test(
  "createAttendance - creates pending attendance for active student's internship",
  async () => {
    const attendance = createAttendanceRecord();

    const service = createMockAttendanceService([
      {
        data: {
          id: INTERNSHIP_ID,
          student_id: STUDENT_ID,
          status: "active",
        },
      },
      {
        data: null,
      },
      {
        data: attendance,
      },
    ]);

    const result = await service.createAttendance(STUDENT_ID, {
      internship_id: INTERNSHIP_ID,
      attendance_date: "2026-08-12",
      time_in: "08:00:00",
      time_out: "17:00:00",
    });

    assertEquals(result, attendance);
    assertEquals(result.validation_status, "pending");
    assertEquals(result.validated_by, null);
    assertEquals(result.validated_at, null);
  },
);

Deno.test("createAttendance - rejects missing internship", async () => {
  const service = createMockAttendanceService([
    {
      data: null,
      error: {
        message: "Not found",
      },
    },
  ]);

  await assertThrowsAsync(
    () =>
      service.createAttendance(STUDENT_ID, {
        internship_id: INTERNSHIP_ID,
        attendance_date: "2026-08-12",
        time_in: "08:00:00",
        time_out: "17:00:00",
      }),
    AppError,
    "Internship not found.",
  );
});

Deno.test(
  "createAttendance - rejects attendance for another student's internship",
  async () => {
    const service = createMockAttendanceService([
      {
        data: {
          id: INTERNSHIP_ID,
          student_id: OTHER_STUDENT_ID,
          status: "active",
        },
      },
    ]);

    await assertThrowsAsync(
      () =>
        service.createAttendance(STUDENT_ID, {
          internship_id: INTERNSHIP_ID,
          attendance_date: "2026-08-12",
          time_in: "08:00:00",
          time_out: "17:00:00",
        }),
      AppError,
      "You can only record attendance for your own internship.",
    );
  },
);

Deno.test("createAttendance - rejects inactive internship", async () => {
  const service = createMockAttendanceService([
    {
      data: {
        id: INTERNSHIP_ID,
        student_id: STUDENT_ID,
        status: "pending",
      },
    },
  ]);

  await assertThrowsAsync(
    () =>
      service.createAttendance(STUDENT_ID, {
        internship_id: INTERNSHIP_ID,
        attendance_date: "2026-08-12",
        time_in: "08:00:00",
        time_out: "17:00:00",
      }),
    AppError,
    "Attendance can only be recorded for an active internship.",
  );
});

Deno.test("createAttendance - rejects duplicate attendance date", async () => {
  const existing = createAttendanceRecord();

  const service = createMockAttendanceService([
    {
      data: {
        id: INTERNSHIP_ID,
        student_id: STUDENT_ID,
        status: "active",
      },
    },
    {
      data: {
        id: existing.id,
      },
    },
  ]);

  await assertThrowsAsync(
    () =>
      service.createAttendance(STUDENT_ID, {
        internship_id: INTERNSHIP_ID,
        attendance_date: "2026-08-12",
        time_in: "08:00:00",
        time_out: "17:00:00",
      }),
    AppError,
    "Attendance for this date already exists.",
  );
});

Deno.test(
  "createAttendance - rejects duplicate-check database failure",
  async () => {
    const service = createMockAttendanceService([
      {
        data: {
          id: INTERNSHIP_ID,
          student_id: STUDENT_ID,
          status: "active",
        },
      },
      {
        data: null,
        error: {
          message: "Database failure",
        },
      },
    ]);

    await assertThrowsAsync(
      () =>
        service.createAttendance(STUDENT_ID, {
          internship_id: INTERNSHIP_ID,
          attendance_date: "2026-08-12",
          time_in: "08:00:00",
          time_out: "17:00:00",
        }),
      AppError,
      "Failed to check existing attendance.",
    );
  },
);

Deno.test("createAttendance - rejects database insert failure", async () => {
  const service = createMockAttendanceService([
    {
      data: {
        id: INTERNSHIP_ID,
        student_id: STUDENT_ID,
        status: "active",
      },
    },
    {
      data: null,
    },
    {
      data: null,
      error: {
        message: "Insert failed",
      },
    },
  ]);

  await assertThrowsAsync(
    () =>
      service.createAttendance(STUDENT_ID, {
        internship_id: INTERNSHIP_ID,
        attendance_date: "2026-08-12",
        time_in: "08:00:00",
        time_out: "17:00:00",
      }),
    AppError,
    "Failed to create attendance record.",
  );
});

/*
 * ---------------------------------------------------------
 * RETRIEVAL
 * ---------------------------------------------------------
 */

Deno.test("getAttendanceById - returns attendance record", async () => {
  const attendance = createAttendanceRecord();

  const service = createMockAttendanceService([
    {
      data: attendance,
    },
  ]);

  const result = await service.getAttendanceById(ATTENDANCE_ID);

  assertEquals(result, attendance);
});

Deno.test("getAttendanceById - throws when record does not exist", async () => {
  const service = createMockAttendanceService([
    {
      data: null,
      error: {
        message: "Not found",
      },
    },
  ]);

  await assertThrowsAsync(
    () => service.getAttendanceById(ATTENDANCE_ID),
    AppError,
    "Attendance record not found.",
  );
});

Deno.test(
  "getMyAttendance - returns student's attendance records",
  async () => {
    const records = [
      createAttendanceRecord({
        attendance_date: "2026-08-10",
      }),
      createAttendanceRecord({
        id: "66666666-6666-6666-6666-666666666666",
        attendance_date: "2026-08-11",
      }),
    ];

    const service = createMockAttendanceService([
      {
        data: records.map((record) => ({
          ...record,
          internships: {
            student_id: STUDENT_ID,
          },
        })),
      },
    ]);

    const result = await service.getMyAttendance(STUDENT_ID);

    assertEquals(result, records);
  },
);

Deno.test(
  "getMyAttendance - returns empty array when no records exist",
  async () => {
    const service = createMockAttendanceService([
      {
        data: [],
      },
    ]);

    const result = await service.getMyAttendance(STUDENT_ID);

    assertEquals(result, []);
  },
);

Deno.test("getMyAttendance - rejects database failure", async () => {
  const service = createMockAttendanceService([
    {
      data: null,
      error: {
        message: "Database failure",
      },
    },
  ]);

  await assertThrowsAsync(
    () => service.getMyAttendance(STUDENT_ID),
    AppError,
    "Failed to retrieve attendance records.",
  );
});

Deno.test(
  "getAttendanceByInternship - returns attendance records",
  async () => {
    const records = [
      createAttendanceRecord(),
      createAttendanceRecord({
        id: "66666666-6666-6666-6666-666666666666",
      }),
    ];

    const service = createMockAttendanceService([
      {
        data: records,
      },
    ]);

    const result = await service.getAttendanceByInternship(INTERNSHIP_ID);

    assertEquals(result, records);
  },
);

Deno.test(
  "getAttendanceByInternship - returns empty array when no records exist",
  async () => {
    const service = createMockAttendanceService([
      {
        data: [],
      },
    ]);

    const result = await service.getAttendanceByInternship(INTERNSHIP_ID);

    assertEquals(result, []);
  },
);

/*
 * ---------------------------------------------------------
 * VALIDATION
 * ---------------------------------------------------------
 */

Deno.test("validateAttendance - validates pending attendance", async () => {
  const pending = createAttendanceRecord();

  const validated = createAttendanceRecord({
    validation_status: "validated",
    validated_by: COORDINATOR_ID,
    validated_at: "2026-08-12T10:00:00.000Z",
  });

  const service = createMockAttendanceService([
    {
      data: pending,
    },
    {
      data: {
        id: COORDINATOR_ID,
        role: "internship_coordinator",
        is_active: true,
      },
    },
    {
      data: validated,
    },
  ]);

  const result = await service.validateAttendance(
    ATTENDANCE_ID,
    COORDINATOR_ID,
    "validated",
  );

  assertEquals(result, validated);
  assertEquals(result.validation_status, "validated");
  assertEquals(result.validated_by, COORDINATOR_ID);
  assertEquals(result.validated_at !== null, true);
});

Deno.test("validateAttendance - rejects pending attendance", async () => {
  const pending = createAttendanceRecord();

  const rejected = createAttendanceRecord({
    validation_status: "rejected",
    validated_by: COORDINATOR_ID,
    validated_at: "2026-08-12T10:00:00.000Z",
  });

  const service = createMockAttendanceService([
    {
      data: pending,
    },
    {
      data: {
        id: COORDINATOR_ID,
        role: "internship_coordinator",
        is_active: true,
      },
    },
    {
      data: rejected,
    },
  ]);

  const result = await service.validateAttendance(
    ATTENDANCE_ID,
    COORDINATOR_ID,
    "rejected",
  );

  assertEquals(result, rejected);
  assertEquals(result.validation_status, "rejected");
  assertEquals(result.validated_by, COORDINATOR_ID);
  assertEquals(result.validated_at !== null, true);
});

Deno.test(
  "validateAttendance - rejects already validated attendance",
  async () => {
    const attendance = createAttendanceRecord({
      validation_status: "validated",
    });

    const service = createMockAttendanceService([
      {
        data: attendance,
      },
    ]);

    await assertThrowsAsync(
      () => service.validateAttendance(ATTENDANCE_ID, COORDINATOR_ID, "rejected"),
      AppError,
      "Only pending attendance records can be validated.",
    );
  },
);

Deno.test(
  "validateAttendance - rejects already rejected attendance",
  async () => {
    const attendance = createAttendanceRecord({
      validation_status: "rejected",
    });

    const service = createMockAttendanceService([
      {
        data: attendance,
      },
    ]);

    await assertThrowsAsync(
      () => service.validateAttendance(ATTENDANCE_ID, COORDINATOR_ID, "validated"),
      AppError,
      "Only pending attendance records can be validated.",
    );
  },
);

Deno.test("validateAttendance - rejects inactive coordinator", async () => {
  const pending = createAttendanceRecord();

  const service = createMockAttendanceService([
    {
      data: pending,
    },
    {
      data: {
        id: COORDINATOR_ID,
        role: "internship_coordinator",
        is_active: false,
      },
    },
  ]);

  await assertThrowsAsync(
    () => service.validateAttendance(ATTENDANCE_ID, COORDINATOR_ID, "validated"),
    AppError,
    "Only an active internship coordinator can validate attendance.",
  );
});

Deno.test("validateAttendance - rejects non-coordinator", async () => {
  const pending = createAttendanceRecord();

  const service = createMockAttendanceService([
    {
      data: pending,
    },
    {
      data: {
        id: COORDINATOR_ID,
        role: "student",
        is_active: true,
      },
    },
  ]);

  await assertThrowsAsync(
    () => service.validateAttendance(ATTENDANCE_ID, COORDINATOR_ID, "validated"),
    AppError,
    "Only an active internship coordinator can validate attendance.",
  );
});

Deno.test("validateAttendance - rejects missing coordinator", async () => {
  const pending = createAttendanceRecord();

  const service = createMockAttendanceService([
    {
      data: pending,
    },
    {
      data: null,
      error: {
        message: "Coordinator not found",
      },
    },
  ]);

  await assertThrowsAsync(
    () => service.validateAttendance(ATTENDANCE_ID, COORDINATOR_ID, "validated"),
    AppError,
    "Only an active internship coordinator can validate attendance.",
  );
});

/*
 * ---------------------------------------------------------
 * RENDERED HOURS
 * ---------------------------------------------------------
 */

Deno.test("getRenderedHours - counts only validated attendance", async () => {
  const records = [
    createAttendanceRecord({
      validation_status: "validated",
      time_in: "08:00:00",
      time_out: "17:00:00",
    }),
    createAttendanceRecord({
      id: "66666666-6666-6666-6666-666666666666",
      validation_status: "pending",
      time_in: "08:00:00",
      time_out: "17:00:00",
    }),
    createAttendanceRecord({
      id: "77777777-7777-7777-7777-777777777777",
      validation_status: "rejected",
      time_in: "08:00:00",
      time_out: "17:00:00",
    }),
  ];

  const service = createMockAttendanceService([
    {
      data: records,
    },
  ]);

  const result = await service.getRenderedHours(INTERNSHIP_ID);

  assertEquals(result, 8);
});

Deno.test(
  "getRenderedHours - returns zero when no attendance is validated",
  async () => {
    const records = [
      createAttendanceRecord({
        validation_status: "pending",
      }),
      createAttendanceRecord({
        id: "66666666-6666-6666-6666-666666666666",
        validation_status: "rejected",
      }),
    ];

    const service = createMockAttendanceService([
      {
        data: records,
      },
    ]);

    const result = await service.getRenderedHours(INTERNSHIP_ID);

    assertEquals(result, 0);
  },
);

/*
 * ---------------------------------------------------------
 * UPDATE
 * ---------------------------------------------------------
 */

Deno.test(
  "updateAttendance - updates pending attendance owned by student",
  async () => {
    const pending = createAttendanceRecord();

    const updated = createAttendanceRecord({
      attendance_date: "2026-08-13",
      time_in: "09:00:00",
      time_out: "18:00:00",
    });

    const service = createMockAttendanceService([
      {
        data: pending,
      },
      {
        data: {
          id: INTERNSHIP_ID,
          student_id: STUDENT_ID,
          status: "active",
        },
      },
      {
        data: null,
      },
      {
        data: updated,
      },
    ]);

    const result = await service.updateAttendance(ATTENDANCE_ID, STUDENT_ID, {
      attendance_date: "2026-08-13",
      time_in: "09:00:00",
      time_out: "18:00:00",
    });

    assertEquals(result, updated);
  },
);

Deno.test(
  "updateAttendance - allows partial update of pending attendance",
  async () => {
    const pending = createAttendanceRecord();

    const updated = createAttendanceRecord({
      time_in: "09:00:00",
    });

    const service = createMockAttendanceService([
      {
        data: pending,
      },
      {
        data: {
          id: INTERNSHIP_ID,
          student_id: STUDENT_ID,
          status: "active",
        },
      },
      {
        data: null,
      },
      {
        data: updated,
      },
    ]);

    const result = await service.updateAttendance(ATTENDANCE_ID, STUDENT_ID, {
      time_in: "09:00:00",
    });

    assertEquals(result, updated);
  },
);

Deno.test("updateAttendance - rejects validated attendance", async () => {
  const attendance = createAttendanceRecord({
    validation_status: "validated",
  });

  const service = createMockAttendanceService([
    {
      data: attendance,
    },
  ]);

  await assertThrowsAsync(
    () =>
      service.updateAttendance(ATTENDANCE_ID, STUDENT_ID, {
        time_in: "09:00:00",
      }),
    AppError,
    "Only pending attendance records can be updated.",
  );
});

Deno.test("updateAttendance - rejects rejected attendance", async () => {
  const attendance = createAttendanceRecord({
    validation_status: "rejected",
  });

  const service = createMockAttendanceService([
    {
      data: attendance,
    },
  ]);

  await assertThrowsAsync(
    () =>
      service.updateAttendance(ATTENDANCE_ID, STUDENT_ID, {
        time_in: "09:00:00",
      }),
    AppError,
    "Only pending attendance records can be updated.",
  );
});

Deno.test(
  "updateAttendance - rejects another student's attendance",
  async () => {
    const pending = createAttendanceRecord();

    const service = createMockAttendanceService([
      {
        data: pending,
      },
      {
        data: {
          id: INTERNSHIP_ID,
          student_id: OTHER_STUDENT_ID,
          status: "active",
        },
      },
    ]);

    await assertThrowsAsync(
      () =>
        service.updateAttendance(ATTENDANCE_ID, STUDENT_ID, {
          time_in: "09:00:00",
        }),
      AppError,
      "You can only update your own attendance.",
    );
  },
);

Deno.test("updateAttendance - rejects inactive internship", async () => {
  const pending = createAttendanceRecord();

  const service = createMockAttendanceService([
    {
      data: pending,
    },
    {
      data: {
        id: INTERNSHIP_ID,
        student_id: STUDENT_ID,
        status: "completed",
      },
    },
  ]);

  await assertThrowsAsync(
    () =>
      service.updateAttendance(ATTENDANCE_ID, STUDENT_ID, {
        time_in: "09:00:00",
      }),
    AppError,
    "Attendance can only be updated for an active internship.",
  );
});

Deno.test("updateAttendance - rejects duplicate attendance date", async () => {
  const pending = createAttendanceRecord();

  const service = createMockAttendanceService([
    {
      data: pending,
    },
    {
      data: {
        id: INTERNSHIP_ID,
        student_id: STUDENT_ID,
        status: "active",
      },
    },
    {
      data: {
        id: "66666666-6666-6666-6666-666666666666",
      },
    },
  ]);

  await assertThrowsAsync(
    () =>
      service.updateAttendance(ATTENDANCE_ID, STUDENT_ID, {
        attendance_date: "2026-08-13",
      }),
    AppError,
    "Attendance for this date already exists.",
  );
});

Deno.test(
  "updateAttendance - rejects invalid resulting time range",
  async () => {
    const pending = createAttendanceRecord();

    const service = createMockAttendanceService([
      {
        data: pending,
      },
      {
        data: {
          id: INTERNSHIP_ID,
          student_id: STUDENT_ID,
          status: "active",
        },
      },
    ]);

    await assertThrowsAsync(
      () =>
        service.updateAttendance(ATTENDANCE_ID, STUDENT_ID, {
          time_in: "18:00:00",
        }),
      AppError,
      "Time-out must be later than time-in.",
    );
  },
);

Deno.test(
  "updateAttendance - rejects duplicate-check database failure",
  async () => {
    const pending = createAttendanceRecord();

    const service = createMockAttendanceService([
      {
        data: pending,
      },
      {
        data: {
          id: INTERNSHIP_ID,
          student_id: STUDENT_ID,
          status: "active",
        },
      },
      {
        data: null,
        error: {
          message: "Database failure",
        },
      },
    ]);

    await assertThrowsAsync(
      () =>
        service.updateAttendance(ATTENDANCE_ID, STUDENT_ID, {
          attendance_date: "2026-08-13",
        }),
      AppError,
      "Failed to check existing attendance.",
    );
  },
);

Deno.test("updateAttendance - rejects update database failure", async () => {
  const pending = createAttendanceRecord();

  const service = createMockAttendanceService([
    {
      data: pending,
    },
    {
      data: {
        id: INTERNSHIP_ID,
        student_id: STUDENT_ID,
        status: "active",
      },
    },
    {
      data: null,
    },
    {
      data: null,
      error: {
        message: "Update failed",
      },
    },
  ]);

  await assertThrowsAsync(
    () =>
      service.updateAttendance(ATTENDANCE_ID, STUDENT_ID, {
        time_in: "09:00:00",
      }),
    AppError,
    "Failed to update attendance.",
  );
});

/*
 * ---------------------------------------------------------
 * TEST HELPER
 * ---------------------------------------------------------
 *
 * Deno's assertThrows is synchronous, while service methods
 * return promises. Keep the async exception assertion local
 * to this test file so the service tests remain dependency-free.
 */
async function assertThrowsAsync(
  fn: () => Promise<unknown>,
  ErrorClass: new (...args: any[]) => Error,
  message?: string,
): Promise<void> {
  try {
    await fn();
  } catch (error) {
    if (!(error instanceof ErrorClass)) {
      throw new Error(
        `Expected ${ErrorClass.name}, but received ${
          error instanceof Error ? error.constructor.name : typeof error
        }.`,
      );
    }

    if (message !== undefined) {
      assertEquals((error as Error).message, message);
    }

    return;
  }

  throw new Error(
    `Expected ${ErrorClass.name} to be thrown, but no error was thrown.`,
  );
}
