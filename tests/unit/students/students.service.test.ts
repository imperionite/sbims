import { assertEquals, assertRejects } from "@std/assert";

import { AppError } from "../../../src/errors/app-error.ts";
import { StudentService } from "../../../src/modules/students/students.service.ts";
import type { SupabaseClients } from "../../../src/lib/supabase.ts";

const testStudentId = "11111111-1111-1111-1111-111111111111";
const testNonStudentId = "22222222-2222-2222-2222-222222222222";

const mockStudentProfile = {
  id: testStudentId,
  student_number: "2026-00001",
  program: "BS Information Technology",
  year_level: 4,
  section: "4A",
  contact_number: "09171234567",
  address: "Bulacan",
  emergency_contact_name: "Jane Doe",
  emergency_contact_number: "09181234567",
  internship_status: "pending",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

type MockResponse = {
  data?: unknown;
  error?: unknown;
};

type MockOptions = {
  profiles?: MockResponse;
  studentProfiles?: MockResponse;
};

function createMockSupabase(options: MockOptions = {}) {
  const calls: Array<{
    table: string;
    operation: string;
    payload?: unknown;
  }> = [];

  const defaultProfiles: MockResponse = {
    data: null,
    error: null,
  };

  const defaultStudentProfiles: MockResponse = {
    data: null,
    error: null,
  };

  const supabaseAdmin = {
    from(table: string) {
      const builder = {
        select(_columns?: string) {
          return builder;
        },

        insert(value: unknown) {
          calls.push({
            table,
            operation: "insert",
            payload: value,
          });

          return builder;
        },

        update(value: unknown) {
          calls.push({
            table,
            operation: "update",
            payload: value,
          });

          return builder;
        },

        eq(_column: string, _value: unknown) {
          return builder;
        },

        order(_column: string, _options?: unknown) {
          return builder;
        },

        maybeSingle() {
          if (table === "profiles") {
            return Promise.resolve(options.profiles ?? defaultProfiles);
          }

          return Promise.resolve(
            options.studentProfiles ?? defaultStudentProfiles,
          );
        },

        single() {
          if (table === "student_profiles") {
            return Promise.resolve(
              options.studentProfiles ?? {
                data: mockStudentProfile,
                error: null,
              },
            );
          }

          return Promise.resolve(options.profiles ?? defaultProfiles);
        },
      };

      return builder;
    },
  };

  const supabaseClient = supabaseAdmin;

  const supabase = {
    supabaseClient,
    supabaseAdmin,
  } as unknown as SupabaseClients;

  return {
    supabase,
    calls,
  };
}

Deno.test("StudentService should return student profile by ID", async () => {
  const { supabase } = createMockSupabase({
    studentProfiles: {
      data: mockStudentProfile,
      error: null,
    },
  });

  const service = new StudentService(supabase);

  const result = await service.getStudent(testStudentId);

  assertEquals(result, mockStudentProfile);
});

Deno.test("StudentService should reject missing student profile", async () => {
  const { supabase } = createMockSupabase({
    studentProfiles: {
      data: null,
      error: null,
    },
  });

  const service = new StudentService(supabase);

  await assertRejects(
    () => service.getStudent(testStudentId),
    AppError,
    "Student profile not found.",
  );
});

Deno.test(
  "StudentService should convert student profile retrieval errors to AppError",
  async () => {
    const { supabase } = createMockSupabase({
      studentProfiles: {
        data: null,
        error: new Error("Database error"),
      },
    });

    const service = new StudentService(supabase);

    await assertRejects(
      () => service.getStudent(testStudentId),
      AppError,
      "Unable to retrieve student profile.",
    );
  },
);

Deno.test(
  "StudentService should return the authenticated student's profile",
  async () => {
    const { supabase } = createMockSupabase({
      studentProfiles: {
        data: mockStudentProfile,
        error: null,
      },
    });

    const service = new StudentService(supabase);

    const result = await service.getMyStudentProfile(testStudentId);

    assertEquals(result, mockStudentProfile);
  },
);

Deno.test(
  "StudentService should create a student profile for a valid student user",
  async () => {
    const studentUserId = testStudentId;

    const createdStudent = {
      id: studentUserId,
      student_number: "2026-00001",
      program: "BS Information Technology",
      year_level: 4,
      section: "4A",
      contact_number: "09171234567",
      address: "Bulacan",
      emergency_contact_name: "Emergency Contact",
      emergency_contact_number: "09987654321",
      internship_status: "pending",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };

    let checkCount = 0;
    const { supabase, calls } = createMockSupabase({
      profiles: {
        data: {
          id: studentUserId,
          role: "student",
          is_active: true,
        },
        error: null,
      },
    });

    const originalFrom = supabase.supabaseAdmin.from;
    supabase.supabaseAdmin.from = (table: string) => {
      // deno-lint-ignore no-explicit-any
      const builder: any = originalFrom(table);
      if (table === "student_profiles") {
        builder.maybeSingle = () => {
          checkCount++;
          if (checkCount === 1) {
            return Promise.resolve({ data: null, error: null });
          }
          return Promise.resolve({ data: createdStudent, error: null });
        };
        builder.single = () => {
          return Promise.resolve({ data: createdStudent, error: null });
        };
      }
      return builder;
    };

    const service = new StudentService(supabase);

    const result = await service.createStudent({
      userId: studentUserId,
      studentNumber: "2026-00001",
      program: "BS Information Technology",
      yearLevel: 4,
      section: "4A",
      contactNumber: "09171234567",
      address: "Bulacan",
      emergencyContactName: "Emergency Contact",
      emergencyContactNumber: "09987654321",
    });

    assertEquals(result, createdStudent);

    const insertCall = calls.find(
      (call) => call.table === "student_profiles" && call.operation === "insert",
    );

    assertEquals(insertCall?.payload, {
      id: studentUserId,
      student_number: "2026-00001",
      program: "BS Information Technology",
      year_level: 4,
      section: "4A",
      contact_number: "09171234567",
      address: "Bulacan",
      emergency_contact_name: "Emergency Contact",
      emergency_contact_number: "09987654321",
    });
  },
);

Deno.test(
  "StudentService should reject creation when student user does not exist",
  async () => {
    const { supabase } = createMockSupabase({
      profiles: {
        data: null,
        error: null,
      },
    });

    const service = new StudentService(supabase);

    await assertRejects(
      () =>
        service.createStudent({
          userId: testStudentId,
          studentNumber: "2026-00001",
          program: "BS Information Technology",
          yearLevel: 4,
        }),
      AppError,
      "Student user not found.",
    );
  },
);

Deno.test(
  "StudentService should reject creation when user is not a student",
  async () => {
    const { supabase } = createMockSupabase({
      profiles: {
        data: {
          id: testNonStudentId,
          role: "faculty_adviser",
          is_active: true,
        },
        error: null,
      },
    });

    const service = new StudentService(supabase);

    await assertRejects(
      () =>
        service.createStudent({
          userId: testNonStudentId,
          studentNumber: "2026-00002",
          program: "BS Information Technology",
          yearLevel: 4,
        }),
      AppError,
      "The selected user does not have the student role.",
    );
  },
);

Deno.test(
  "StudentService should reject creation when student account is inactive",
  async () => {
    const { supabase } = createMockSupabase({
      profiles: {
        data: {
          id: testStudentId,
          role: "student",
          is_active: false,
        },
        error: null,
      },
    });

    const service = new StudentService(supabase);

    await assertRejects(
      () =>
        service.createStudent({
          userId: testStudentId,
          studentNumber: "2026-00001",
          program: "BS Information Technology",
          yearLevel: 4,
        }),
      AppError,
      "The selected student account is inactive.",
    );
  },
);

Deno.test(
  "StudentService should reject duplicate student profile",
  async () => {
    const { supabase } = createMockSupabase({
      profiles: {
        data: {
          id: testStudentId,
          role: "student",
          is_active: true,
        },
        error: null,
      },

      studentProfiles: {
        data: {
          id: testStudentId,
        },
        error: null,
      },
    });

    const service = new StudentService(supabase);

    await assertRejects(
      () =>
        service.createStudent({
          userId: testStudentId,
          studentNumber: "2026-00001",
          program: "BS Information Technology",
          yearLevel: 4,
        }),
      AppError,
      "A student profile already exists for this user.",
    );
  },
);

Deno.test("StudentService should reject empty student update", async () => {
  const { supabase } = createMockSupabase();

  const service = new StudentService(supabase);

  await assertRejects(
    () => service.updateStudent(testStudentId, {}),
    AppError,
    "At least one student profile field is required.",
  );
});

Deno.test(
  "StudentService should update student academic and internship fields",
  async () => {
    const updatedStudent = {
      ...mockStudentProfile,
      program: "BS Computer Science",
      year_level: 4,
      internship_status: "active",
    };

    const { supabase, calls } = createMockSupabase({
      studentProfiles: {
        data: updatedStudent,
        error: null,
      },
    });

    const service = new StudentService(supabase);

    const result = await service.updateStudent(testStudentId, {
      program: "BS Computer Science",
      yearLevel: 4,
      internshipStatus: "active",
    });

    assertEquals(result, updatedStudent);

    const updateCall = calls.find(
      (call) => call.table === "student_profiles" && call.operation === "update",
    );

    assertEquals(updateCall?.payload, {
      program: "BS Computer Science",
      year_level: 4,
      internship_status: "active",
    });
  },
);

Deno.test("StudentService should update nullable student fields", async () => {
  const updatedStudent = {
    ...mockStudentProfile,
    section: null,
    contact_number: null,
    address: null,
  };

  const { supabase, calls } = createMockSupabase({
    studentProfiles: {
      data: updatedStudent,
      error: null,
    },
  });

  const service = new StudentService(supabase);

  const result = await service.updateStudent(testStudentId, {
    section: null,
    contactNumber: null,
    address: null,
  });

  assertEquals(result, updatedStudent);

  const updateCall = calls.find(
    (call) => call.table === "student_profiles" && call.operation === "update",
  );

  assertEquals(updateCall?.payload, {
    section: null,
    contact_number: null,
    address: null,
  });
});

Deno.test(
  "StudentService should reject updating a non-existent student",
  async () => {
    const { supabase } = createMockSupabase({
      studentProfiles: {
        data: null,
        error: null,
      },
    });

    const service = new StudentService(supabase);

    await assertRejects(
      () =>
        service.updateStudent(testStudentId, {
          internshipStatus: "active",
        }),
      AppError,
      "Student profile not found.",
    );
  },
);

Deno.test(
  "StudentService should allow a student to update personal information",
  async () => {
    const updatedStudent = {
      ...mockStudentProfile,
      contact_number: "09991234567",
      address: "Updated Address",
    };

    const { supabase, calls } = createMockSupabase({
      studentProfiles: {
        data: updatedStudent,
        error: null,
      },
    });

    const service = new StudentService(supabase);

    const result = await service.updateMyStudentProfile(testStudentId, {
      contactNumber: "09991234567",
      address: "Updated Address",
    });

    assertEquals(result, updatedStudent);

    const updateCall = calls.find(
      (call) => call.table === "student_profiles" && call.operation === "update",
    );

    assertEquals(updateCall?.payload, {
      contact_number: "09991234567",
      address: "Updated Address",
    });
  },
);

Deno.test(
  "StudentService should allow a student to clear personal fields",
  async () => {
    const updatedStudent = {
      ...mockStudentProfile,
      contact_number: null,
      address: null,
      emergency_contact_name: null,
      emergency_contact_number: null,
    };

    const { supabase } = createMockSupabase({
      studentProfiles: {
        data: updatedStudent,
        error: null,
      },
    });

    const service = new StudentService(supabase);

    const result = await service.updateMyStudentProfile(testStudentId, {
      contactNumber: null,
      address: null,
      emergencyContactName: null,
      emergencyContactNumber: null,
    });

    assertEquals(result, updatedStudent);
  },
);

Deno.test("StudentService should reject empty self-update", async () => {
  const { supabase } = createMockSupabase();

  const service = new StudentService(supabase);

  await assertRejects(
    () => service.updateMyStudentProfile(testStudentId, {}),
    AppError,
    "At least one student profile field is required.",
  );
});

Deno.test(
  "StudentService should reject updating a missing student self-profile",
  async () => {
    const { supabase } = createMockSupabase({
      studentProfiles: {
        data: null,
        error: null,
      },
    });

    const service = new StudentService(supabase);

    await assertRejects(
      () =>
        service.updateMyStudentProfile(testStudentId, {
          address: "New Address",
        }),
      AppError,
      "Student profile not found.",
    );
  },
);

Deno.test(
  "StudentService should convert student update database errors to AppError",
  async () => {
    const { supabase } = createMockSupabase({
      studentProfiles: {
        data: null,
        error: {
          message: "Database update failed",
        },
      },
    });

    const service = new StudentService(supabase);

    await assertRejects(
      () =>
        service.updateStudent(testStudentId, {
          internshipStatus: "active",
        }),
      AppError,
      "Database update failed",
    );
  },
);

Deno.test(
  "StudentService should convert self-update database errors to AppError",
  async () => {
    const { supabase } = createMockSupabase({
      studentProfiles: {
        data: null,
        error: {
          message: "Database update failed",
        },
      },
    });

    const service = new StudentService(supabase);

    await assertRejects(
      () =>
        service.updateMyStudentProfile(testStudentId, {
          address: "New Address",
        }),
      AppError,
      "Database update failed",
    );
  },
);
