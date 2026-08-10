import { assertEquals, assertRejects } from "@std/assert";

import { StudentService, studentService } from "../../../src/modules/students/students.service.ts";
import { AppError } from "../../../src/errors/app-error.ts";
import { supabaseAdmin } from "../../../src/lib/supabase.ts";

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

function mockSupabase(options: MockOptions = {}) {
  const calls: Array<{
    table: string;
    operation: string;
    payload?: unknown;
  }> = [];

  const originalFrom = supabaseAdmin.from;

  supabaseAdmin.from = ((table: string) => {
    let operation = "";
    let payload: unknown;

    const builder = {
      select(_columns?: string) {
        operation = "select";
        return builder;
      },

      insert(value: unknown) {
        operation = "insert";
        payload = value;
        calls.push({
          table,
          operation,
          payload,
        });
        return builder;
      },

      update(value: unknown) {
        operation = "update";
        payload = value;
        calls.push({
          table,
          operation,
          payload,
        });
        return builder;
      },

      eq(_column: string, _value: string) {
        return builder;
      },

      order(_column: string, _options: unknown) {
        return builder;
      },

      maybeSingle() {
        if (table === "profiles") {
          return Promise.resolve(
            options.profiles ?? {
              data: null,
              error: null,
            },
          );
        }

        return Promise.resolve(
          options.studentProfiles ?? {
            data: null,
            error: null,
          },
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

        return Promise.resolve(
          options.profiles ?? {
            data: null,
            error: null,
          },
        );
      },
    };

    return builder;
  }) as unknown as typeof supabaseAdmin.from;

  return {
    calls,
    restore() {
      supabaseAdmin.from = originalFrom;
    },
  };
}

Deno.test("StudentService should return student profile by ID", async () => {
  const mock = mockSupabase({
    studentProfiles: {
      data: mockStudentProfile,
      error: null,
    },
  });

  try {
    const service = new StudentService();

    const result = await service.getStudent(testStudentId);

    assertEquals(result, mockStudentProfile);
  } finally {
    mock.restore();
  }
});

Deno.test("StudentService should reject missing student profile", async () => {
  const mock = mockSupabase({
    studentProfiles: {
      data: null,
      error: null,
    },
  });

  try {
    const service = new StudentService();

    await assertRejects(
      () => service.getStudent(testStudentId),
      AppError,
      "Student profile not found.",
    );
  } finally {
    mock.restore();
  }
});

Deno.test(
  "StudentService should convert student profile retrieval errors to AppError",
  async () => {
    const mock = mockSupabase({
      studentProfiles: {
        data: null,
        error: new Error("Database error"),
      },
    });

    try {
      const service = new StudentService();

      await assertRejects(
        () => service.getStudent(testStudentId),
        AppError,
        "Unable to retrieve student profile.",
      );
    } finally {
      mock.restore();
    }
  },
);

Deno.test(
  "StudentService should return the authenticated student's profile",
  async () => {
    const mock = mockSupabase({
      studentProfiles: {
        data: mockStudentProfile,
        error: null,
      },
    });

    try {
      const service = new StudentService();

      const result = await service.getMyStudentProfile(testStudentId);

      assertEquals(result, mockStudentProfile);
    } finally {
      mock.restore();
    }
  },
);

Deno.test(
  "StudentService should create a student profile for a valid student user",
  async () => {
    const originalFrom = supabaseAdmin.from;

    const studentUserId = "22222222-2222-2222-2222-222222222222";

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

    supabaseAdmin.from = ((table: string) => {
      if (table === "profiles") {
        return {
          select() {
            return this;
          },

          eq() {
            return this;
          },

          maybeSingle() {
            return Promise.resolve({
              data: {
                id: studentUserId,
                role: "student",
                is_active: true,
              },
              error: null,
            });
          },
        };
      }

      if (table === "student_profiles") {
        return {
          select() {
            return this;
          },

          eq() {
            return this;
          },

          maybeSingle() {
            return Promise.resolve({
              data: null,
              error: null,
            });
          },

          insert() {
            return this;
          },

          single() {
            return Promise.resolve({
              data: createdStudent,
              error: null,
            });
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }) as unknown as typeof supabaseAdmin.from;

    try {
      const result = await studentService.createStudent({
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

      assertEquals(result.id, studentUserId);
      assertEquals(result.student_number, "2026-00001");
      assertEquals(result.program, "BS Information Technology");
      assertEquals(result.year_level, 4);
      assertEquals(result.section, "4A");
      assertEquals(result.contact_number, "09171234567");
      assertEquals(result.address, "Bulacan");
      assertEquals(result.emergency_contact_name, "Emergency Contact");
      assertEquals(result.emergency_contact_number, "09987654321");
      assertEquals(result.internship_status, "pending");
    } finally {
      supabaseAdmin.from = originalFrom;
    }
  },
);

Deno.test(
  "StudentService should reject creation when student user does not exist",
  async () => {
    const mock = mockSupabase({
      profiles: {
        data: null,
        error: null,
      },
    });

    try {
      const service = new StudentService();

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
    } finally {
      mock.restore();
    }
  },
);

Deno.test(
  "StudentService should reject creation when user is not a student",
  async () => {
    const mock = mockSupabase({
      profiles: {
        data: {
          id: testNonStudentId,
          role: "faculty_adviser",
          is_active: true,
        },
        error: null,
      },
    });

    try {
      const service = new StudentService();

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
    } finally {
      mock.restore();
    }
  },
);

Deno.test(
  "StudentService should reject creation when student account is inactive",
  async () => {
    const mock = mockSupabase({
      profiles: {
        data: {
          id: testStudentId,
          role: "student",
          is_active: false,
        },
        error: null,
      },
    });

    try {
      const service = new StudentService();

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
    } finally {
      mock.restore();
    }
  },
);

Deno.test(
  "StudentService should reject duplicate student profile",
  async () => {
    const mock = mockSupabase({
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

    try {
      const service = new StudentService();

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
    } finally {
      mock.restore();
    }
  },
);

Deno.test("StudentService should reject empty student update", async () => {
  const mock = mockSupabase();

  try {
    const service = new StudentService();

    await assertRejects(
      () => service.updateStudent(testStudentId, {}),
      AppError,
      "At least one student profile field is required.",
    );
  } finally {
    mock.restore();
  }
});

Deno.test(
  "StudentService should update student academic and internship fields",
  async () => {
    const mock = mockSupabase({
      studentProfiles: {
        data: {
          ...mockStudentProfile,
          program: "BS Computer Science",
          year_level: 4,
          internship_status: "active",
        },
        error: null,
      },
    });

    try {
      const service = new StudentService();

      const result = await service.updateStudent(testStudentId, {
        program: "BS Computer Science",
        yearLevel: 4,
        internshipStatus: "active",
      });

      assertEquals(result.program, "BS Computer Science");
      assertEquals(result.year_level, 4);
      assertEquals(result.internship_status, "active");

      const updateCall = mock.calls.find(
        (call) => call.table === "student_profiles" && call.operation === "update",
      );

      assertEquals(updateCall?.payload, {
        program: "BS Computer Science",
        year_level: 4,
        internship_status: "active",
      });
    } finally {
      mock.restore();
    }
  },
);

Deno.test("StudentService should update nullable student fields", async () => {
  const mock = mockSupabase({
    studentProfiles: {
      data: {
        ...mockStudentProfile,
        section: null,
        contact_number: null,
        address: null,
      },
      error: null,
    },
  });

  try {
    const service = new StudentService();

    await service.updateStudent(testStudentId, {
      section: null,
      contactNumber: null,
      address: null,
    });

    const updateCall = mock.calls.find(
      (call) => call.table === "student_profiles" && call.operation === "update",
    );

    assertEquals(updateCall?.payload, {
      section: null,
      contact_number: null,
      address: null,
    });
  } finally {
    mock.restore();
  }
});

Deno.test(
  "StudentService should reject updating a non-existent student",
  async () => {
    const mock = mockSupabase({
      studentProfiles: {
        data: null,
        error: null,
      },
    });

    try {
      const service = new StudentService();

      await assertRejects(
        () =>
          service.updateStudent(testStudentId, {
            internshipStatus: "active",
          }),
        AppError,
        "Student profile not found.",
      );
    } finally {
      mock.restore();
    }
  },
);

Deno.test(
  "StudentService should allow a student to update personal information",
  async () => {
    const mock = mockSupabase({
      studentProfiles: {
        data: {
          ...mockStudentProfile,
          contact_number: "09991234567",
          address: "Updated Address",
        },
        error: null,
      },
    });

    try {
      const service = new StudentService();

      const result = await service.updateMyStudentProfile(testStudentId, {
        contactNumber: "09991234567",
        address: "Updated Address",
      });

      assertEquals(result.contact_number, "09991234567");
      assertEquals(result.address, "Updated Address");

      const updateCall = mock.calls.find(
        (call) => call.table === "student_profiles" && call.operation === "update",
      );

      assertEquals(updateCall?.payload, {
        contact_number: "09991234567",
        address: "Updated Address",
      });
    } finally {
      mock.restore();
    }
  },
);

Deno.test(
  "StudentService should allow a student to clear personal fields",
  async () => {
    const mock = mockSupabase({
      studentProfiles: {
        data: {
          ...mockStudentProfile,
          contact_number: null,
          address: null,
          emergency_contact_name: null,
          emergency_contact_number: null,
        },
        error: null,
      },
    });

    try {
      const service = new StudentService();

      await service.updateMyStudentProfile(testStudentId, {
        contactNumber: null,
        address: null,
        emergencyContactName: null,
        emergencyContactNumber: null,
      });

      const updateCall = mock.calls.find(
        (call) => call.table === "student_profiles" && call.operation === "update",
      );

      assertEquals(updateCall?.payload, {
        contact_number: null,
        address: null,
        emergency_contact_name: null,
        emergency_contact_number: null,
      });
    } finally {
      mock.restore();
    }
  },
);

Deno.test("StudentService should reject empty self-update", async () => {
  const mock = mockSupabase();

  try {
    const service = new StudentService();

    await assertRejects(
      () => service.updateMyStudentProfile(testStudentId, {}),
      AppError,
      "At least one student profile field is required.",
    );
  } finally {
    mock.restore();
  }
});

Deno.test(
  "StudentService should reject updating a missing student self-profile",
  async () => {
    const mock = mockSupabase({
      studentProfiles: {
        data: null,
        error: null,
      },
    });

    try {
      const service = new StudentService();

      await assertRejects(
        () =>
          service.updateMyStudentProfile(testStudentId, {
            address: "New Address",
          }),
        AppError,
        "Student profile not found.",
      );
    } finally {
      mock.restore();
    }
  },
);

Deno.test(
  "StudentService should convert student update database errors to AppError",
  async () => {
    const mock = mockSupabase({
      studentProfiles: {
        data: null,
        error: {
          message: "Database update failed",
        },
      },
    });

    try {
      const service = new StudentService();

      await assertRejects(
        () =>
          service.updateStudent(testStudentId, {
            internshipStatus: "active",
          }),
        AppError,
        "Database update failed",
      );
    } finally {
      mock.restore();
    }
  },
);

Deno.test(
  "StudentService should convert self-update database errors to AppError",
  async () => {
    const mock = mockSupabase({
      studentProfiles: {
        data: null,
        error: {
          message: "Database update failed",
        },
      },
    });

    try {
      const service = new StudentService();

      await assertRejects(
        () =>
          service.updateMyStudentProfile(testStudentId, {
            address: "New Address",
          }),
        AppError,
        "Database update failed",
      );
    } finally {
      mock.restore();
    }
  },
);
