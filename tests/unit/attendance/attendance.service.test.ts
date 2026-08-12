// deno-lint-ignore-file require-await no-explicit-any
import { assertEquals, assertRejects } from "@std/assert";

import { AppError } from "../../../src/errors/app-error.ts";
import { supabaseAdmin } from "../../../src/lib/supabase.ts";

import {
  attendanceService,
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

function mockFromSequence(
  responses: Array<{
    data?: unknown;
    error?: unknown;
  }>,
) {
  let index = 0;

  const originalFrom = supabaseAdmin.from.bind(supabaseAdmin);

  (supabaseAdmin as any).from = (_table: string) => {
    const response = responses[index++];

    if (!response) {
      throw new Error("Unexpected supabaseAdmin.from() call.");
    }

    const result = {
      data: response.data ?? null,
      error: response.error ?? null,
    };

    const builder = {
      select: () => builder,

      eq: () => builder,

      neq: () => builder,

      insert: () => builder,

      update: () => builder,

      order: async () => result,

      single: async () => result,

      maybeSingle: async () => result,
    };

    return builder;
  };

  return () => {
    (supabaseAdmin as any).from = originalFrom;
  };
}

Deno.test(
  "calculateRenderedHours - calculates rendered hours after one-hour break",
  () => {
    assertEquals(calculateRenderedHours("08:00:00", "17:00:00"), 8);

    assertEquals(calculateRenderedHours("08:00:00", "13:00:00"), 4);

    assertEquals(calculateRenderedHours("08:00:00", "12:00:00"), 3);
  },
);

Deno.test(
  "calculateRenderedHours - rejects time-out equal to time-in",
  async () => {
    await assertRejects(
      async () => {
        calculateRenderedHours("08:00:00", "08:00:00");
      },
      AppError,
      "Time-out must be later than time-in.",
    );
  },
);

Deno.test(
  "calculateRenderedHours - rejects time-out earlier than time-in",
  async () => {
    await assertRejects(
      async () => {
        calculateRenderedHours("17:00:00", "08:00:00");
      },
      AppError,
      "Time-out must be later than time-in.",
    );
  },
);

Deno.test(
  "calculateRenderedHours - rejects duration that is too short for the break",
  async () => {
    await assertRejects(
      async () => {
        calculateRenderedHours("08:00:00", "09:00:00");
      },
      AppError,
      "Attendance duration is too short for the standard one-hour break.",
    );
  },
);

Deno.test(
  "createAttendance - creates pending attendance for active student's internship",
  async () => {
    const attendance = createAttendanceRecord();

    const restore = mockFromSequence([
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

    try {
      const result = await attendanceService.createAttendance(STUDENT_ID, {
        internship_id: INTERNSHIP_ID,
        attendance_date: "2026-08-12",
        time_in: "08:00:00",
        time_out: "17:00:00",
      });

      assertEquals(result, attendance);
      assertEquals(result.validation_status, "pending");
      assertEquals(result.validated_by, null);
      assertEquals(result.validated_at, null);
    } finally {
      restore();
    }
  },
);

Deno.test("createAttendance - rejects missing internship", async () => {
  const restore = mockFromSequence([
    {
      data: null,
      error: {
        message: "Not found",
      },
    },
  ]);

  try {
    await assertRejects(
      () =>
        attendanceService.createAttendance(STUDENT_ID, {
          internship_id: INTERNSHIP_ID,
          attendance_date: "2026-08-12",
          time_in: "08:00:00",
          time_out: "17:00:00",
        }),
      AppError,
      "Internship not found.",
    );
  } finally {
    restore();
  }
});

Deno.test(
  "createAttendance - rejects attendance for another student's internship",
  async () => {
    const restore = mockFromSequence([
      {
        data: {
          id: INTERNSHIP_ID,
          student_id: OTHER_STUDENT_ID,
          status: "active",
        },
      },
    ]);

    try {
      await assertRejects(
        () =>
          attendanceService.createAttendance(STUDENT_ID, {
            internship_id: INTERNSHIP_ID,
            attendance_date: "2026-08-12",
            time_in: "08:00:00",
            time_out: "17:00:00",
          }),
        AppError,
        "You can only record attendance for your own internship.",
      );
    } finally {
      restore();
    }
  },
);

Deno.test("createAttendance - rejects inactive internship", async () => {
  const restore = mockFromSequence([
    {
      data: {
        id: INTERNSHIP_ID,
        student_id: STUDENT_ID,
        status: "pending",
      },
    },
  ]);

  try {
    await assertRejects(
      () =>
        attendanceService.createAttendance(STUDENT_ID, {
          internship_id: INTERNSHIP_ID,
          attendance_date: "2026-08-12",
          time_in: "08:00:00",
          time_out: "17:00:00",
        }),
      AppError,
      "Attendance can only be recorded for an active internship.",
    );
  } finally {
    restore();
  }
});

Deno.test("createAttendance - rejects duplicate attendance date", async () => {
  const existing = createAttendanceRecord();

  const restore = mockFromSequence([
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

  try {
    await assertRejects(
      () =>
        attendanceService.createAttendance(STUDENT_ID, {
          internship_id: INTERNSHIP_ID,
          attendance_date: "2026-08-12",
          time_in: "08:00:00",
          time_out: "17:00:00",
        }),
      AppError,
      "Attendance for this date already exists.",
    );
  } finally {
    restore();
  }
});

Deno.test(
  "createAttendance - rejects duplicate-check database failure",
  async () => {
    const restore = mockFromSequence([
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

    try {
      await assertRejects(
        () =>
          attendanceService.createAttendance(STUDENT_ID, {
            internship_id: INTERNSHIP_ID,
            attendance_date: "2026-08-12",
            time_in: "08:00:00",
            time_out: "17:00:00",
          }),
        AppError,
        "Failed to check existing attendance.",
      );
    } finally {
      restore();
    }
  },
);

Deno.test("createAttendance - rejects database insert failure", async () => {
  const restore = mockFromSequence([
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

  try {
    await assertRejects(
      () =>
        attendanceService.createAttendance(STUDENT_ID, {
          internship_id: INTERNSHIP_ID,
          attendance_date: "2026-08-12",
          time_in: "08:00:00",
          time_out: "17:00:00",
        }),
      AppError,
      "Failed to create attendance record.",
    );
  } finally {
    restore();
  }
});

Deno.test("getAttendanceById - returns attendance record", async () => {
  const attendance = createAttendanceRecord();

  const restore = mockFromSequence([
    {
      data: attendance,
    },
  ]);

  try {
    const result = await attendanceService.getAttendanceById(ATTENDANCE_ID);

    assertEquals(result, attendance);
  } finally {
    restore();
  }
});

Deno.test("getAttendanceById - throws when record does not exist", async () => {
  const restore = mockFromSequence([
    {
      data: null,
      error: {
        message: "Not found",
      },
    },
  ]);

  try {
    await assertRejects(
      () => attendanceService.getAttendanceById(ATTENDANCE_ID),
      AppError,
      "Attendance record not found.",
    );
  } finally {
    restore();
  }
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

    const restore = mockFromSequence([
      {
        data: records.map((record) => ({
          ...record,
          internships: {
            student_id: STUDENT_ID,
          },
        })),
      },
    ]);

    try {
      const result = await attendanceService.getMyAttendance(STUDENT_ID);

      assertEquals(result, records);
    } finally {
      restore();
    }
  },
);

Deno.test(
  "getMyAttendance - returns empty array when no records exist",
  async () => {
    const restore = mockFromSequence([
      {
        data: [],
      },
    ]);

    try {
      const result = await attendanceService.getMyAttendance(STUDENT_ID);

      assertEquals(result, []);
    } finally {
      restore();
    }
  },
);

Deno.test("getMyAttendance - rejects database failure", async () => {
  const restore = mockFromSequence([
    {
      data: null,
      error: {
        message: "Database failure",
      },
    },
  ]);

  try {
    await assertRejects(
      () => attendanceService.getMyAttendance(STUDENT_ID),
      AppError,
      "Failed to retrieve attendance records.",
    );
  } finally {
    restore();
  }
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

    const restore = mockFromSequence([
      {
        data: records,
      },
    ]);

    try {
      const result = await attendanceService.getAttendanceByInternship(INTERNSHIP_ID);

      assertEquals(result, records);
    } finally {
      restore();
    }
  },
);

Deno.test(
  "getAttendanceByInternship - returns empty array when no records exist",
  async () => {
    const restore = mockFromSequence([
      {
        data: [],
      },
    ]);

    try {
      const result = await attendanceService.getAttendanceByInternship(INTERNSHIP_ID);

      assertEquals(result, []);
    } finally {
      restore();
    }
  },
);

Deno.test("validateAttendance - validates pending attendance", async () => {
  const pending = createAttendanceRecord();

  const validated = createAttendanceRecord({
    validation_status: "validated",
    validated_by: COORDINATOR_ID,
    validated_at: "2026-08-12T10:00:00.000Z",
  });

  const restore = mockFromSequence([
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

  try {
    const result = await attendanceService.validateAttendance(
      ATTENDANCE_ID,
      COORDINATOR_ID,
      "validated",
    );

    assertEquals(result, validated);
    assertEquals(result.validation_status, "validated");
    assertEquals(result.validated_by, COORDINATOR_ID);
    assertEquals(result.validated_at !== null, true);
  } finally {
    restore();
  }
});

Deno.test("validateAttendance - rejects pending attendance", async () => {
  const pending = createAttendanceRecord();

  const rejected = createAttendanceRecord({
    validation_status: "rejected",
    validated_by: COORDINATOR_ID,
    validated_at: "2026-08-12T10:00:00.000Z",
  });

  const restore = mockFromSequence([
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

  try {
    const result = await attendanceService.validateAttendance(
      ATTENDANCE_ID,
      COORDINATOR_ID,
      "rejected",
    );

    assertEquals(result, rejected);
    assertEquals(result.validation_status, "rejected");
    assertEquals(result.validated_by, COORDINATOR_ID);
    assertEquals(result.validated_at !== null, true);
  } finally {
    restore();
  }
});

Deno.test(
  "validateAttendance - rejects already validated attendance",
  async () => {
    const attendance = createAttendanceRecord({
      validation_status: "validated",
    });

    const restore = mockFromSequence([
      {
        data: attendance,
      },
    ]);

    try {
      await assertRejects(
        () =>
          attendanceService.validateAttendance(
            ATTENDANCE_ID,
            COORDINATOR_ID,
            "rejected",
          ),
        AppError,
        "Only pending attendance records can be validated.",
      );
    } finally {
      restore();
    }
  },
);

Deno.test(
  "validateAttendance - rejects already rejected attendance",
  async () => {
    const attendance = createAttendanceRecord({
      validation_status: "rejected",
    });

    const restore = mockFromSequence([
      {
        data: attendance,
      },
    ]);

    try {
      await assertRejects(
        () =>
          attendanceService.validateAttendance(
            ATTENDANCE_ID,
            COORDINATOR_ID,
            "validated",
          ),
        AppError,
        "Only pending attendance records can be validated.",
      );
    } finally {
      restore();
    }
  },
);

Deno.test("validateAttendance - rejects inactive coordinator", async () => {
  const pending = createAttendanceRecord();

  const restore = mockFromSequence([
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

  try {
    await assertRejects(
      () =>
        attendanceService.validateAttendance(
          ATTENDANCE_ID,
          COORDINATOR_ID,
          "validated",
        ),
      AppError,
      "Only an active internship coordinator can validate attendance.",
    );
  } finally {
    restore();
  }
});

Deno.test("validateAttendance - rejects non-coordinator", async () => {
  const pending = createAttendanceRecord();

  const restore = mockFromSequence([
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

  try {
    await assertRejects(
      () =>
        attendanceService.validateAttendance(
          ATTENDANCE_ID,
          COORDINATOR_ID,
          "validated",
        ),
      AppError,
      "Only an active internship coordinator can validate attendance.",
    );
  } finally {
    restore();
  }
});

Deno.test("validateAttendance - rejects missing coordinator", async () => {
  const pending = createAttendanceRecord();

  const restore = mockFromSequence([
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

  try {
    await assertRejects(
      () =>
        attendanceService.validateAttendance(
          ATTENDANCE_ID,
          COORDINATOR_ID,
          "validated",
        ),
      AppError,
      "Only an active internship coordinator can validate attendance.",
    );
  } finally {
    restore();
  }
});

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

  const restore = mockFromSequence([
    {
      data: records,
    },
  ]);

  try {
    const result = await attendanceService.getRenderedHours(INTERNSHIP_ID);

    assertEquals(result, 8);
  } finally {
    restore();
  }
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

    const restore = mockFromSequence([
      {
        data: records,
      },
    ]);

    try {
      const result = await attendanceService.getRenderedHours(INTERNSHIP_ID);

      assertEquals(result, 0);
    } finally {
      restore();
    }
  },
);

Deno.test(
  "updateAttendance - updates pending attendance owned by student",
  async () => {
    const pending = createAttendanceRecord();

    const updated = createAttendanceRecord({
      attendance_date: "2026-08-13",
      time_in: "09:00:00",
      time_out: "18:00:00",
    });

    const restore = mockFromSequence([
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

    try {
      const result = await attendanceService.updateAttendance(
        ATTENDANCE_ID,
        STUDENT_ID,
        {
          attendance_date: "2026-08-13",
          time_in: "09:00:00",
          time_out: "18:00:00",
        },
      );

      assertEquals(result, updated);
    } finally {
      restore();
    }
  },
);

Deno.test(
  "updateAttendance - allows partial update of pending attendance",
  async () => {
    const pending = createAttendanceRecord();

    const updated = createAttendanceRecord({
      time_in: "09:00:00",
    });

    const restore = mockFromSequence([
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

    try {
      const result = await attendanceService.updateAttendance(
        ATTENDANCE_ID,
        STUDENT_ID,
        {
          time_in: "09:00:00",
        },
      );

      assertEquals(result, updated);
    } finally {
      restore();
    }
  },
);

Deno.test("updateAttendance - rejects validated attendance", async () => {
  const attendance = createAttendanceRecord({
    validation_status: "validated",
  });

  const restore = mockFromSequence([
    {
      data: attendance,
    },
  ]);

  try {
    await assertRejects(
      () =>
        attendanceService.updateAttendance(ATTENDANCE_ID, STUDENT_ID, {
          time_in: "09:00:00",
        }),
      AppError,
      "Only pending attendance records can be updated.",
    );
  } finally {
    restore();
  }
});

Deno.test("updateAttendance - rejects rejected attendance", async () => {
  const attendance = createAttendanceRecord({
    validation_status: "rejected",
  });

  const restore = mockFromSequence([
    {
      data: attendance,
    },
  ]);

  try {
    await assertRejects(
      () =>
        attendanceService.updateAttendance(ATTENDANCE_ID, STUDENT_ID, {
          time_in: "09:00:00",
        }),
      AppError,
      "Only pending attendance records can be updated.",
    );
  } finally {
    restore();
  }
});

Deno.test(
  "updateAttendance - rejects another student's attendance",
  async () => {
    const pending = createAttendanceRecord();

    const restore = mockFromSequence([
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

    try {
      await assertRejects(
        () =>
          attendanceService.updateAttendance(ATTENDANCE_ID, STUDENT_ID, {
            time_in: "09:00:00",
          }),
        AppError,
        "You can only update your own attendance.",
      );
    } finally {
      restore();
    }
  },
);

Deno.test("updateAttendance - rejects inactive internship", async () => {
  const pending = createAttendanceRecord();

  const restore = mockFromSequence([
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

  try {
    await assertRejects(
      () =>
        attendanceService.updateAttendance(ATTENDANCE_ID, STUDENT_ID, {
          time_in: "09:00:00",
        }),
      AppError,
      "Attendance can only be updated for an active internship.",
    );
  } finally {
    restore();
  }
});

Deno.test("updateAttendance - rejects duplicate attendance date", async () => {
  const pending = createAttendanceRecord();

  const restore = mockFromSequence([
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

  try {
    await assertRejects(
      () =>
        attendanceService.updateAttendance(ATTENDANCE_ID, STUDENT_ID, {
          attendance_date: "2026-08-13",
        }),
      AppError,
      "Attendance for this date already exists.",
    );
  } finally {
    restore();
  }
});

Deno.test(
  "updateAttendance - rejects invalid resulting time range",
  async () => {
    const pending = createAttendanceRecord();

    const restore = mockFromSequence([
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

    try {
      await assertRejects(
        () =>
          attendanceService.updateAttendance(ATTENDANCE_ID, STUDENT_ID, {
            time_in: "18:00:00",
          }),
        AppError,
        "Time-out must be later than time-in.",
      );
    } finally {
      restore();
    }
  },
);

Deno.test(
  "updateAttendance - rejects duplicate-check database failure",
  async () => {
    const pending = createAttendanceRecord();

    const restore = mockFromSequence([
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

    try {
      await assertRejects(
        () =>
          attendanceService.updateAttendance(ATTENDANCE_ID, STUDENT_ID, {
            attendance_date: "2026-08-13",
          }),
        AppError,
        "Failed to check existing attendance.",
      );
    } finally {
      restore();
    }
  },
);

Deno.test("updateAttendance - rejects update database failure", async () => {
  const pending = createAttendanceRecord();

  const restore = mockFromSequence([
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

  try {
    await assertRejects(
      () =>
        attendanceService.updateAttendance(ATTENDANCE_ID, STUDENT_ID, {
          time_in: "09:00:00",
        }),
      AppError,
      "Failed to update attendance.",
    );
  } finally {
    restore();
  }
});
