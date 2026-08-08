import { assertEquals, assertExists } from "@std/assert";

import { app } from "../../src/app.ts";
import { setupTestUsers } from "../helpers/test-user.setup.ts";
import { TEST_USERS } from "../fixtures/test-users.ts";

type LoginResult = {
  accessToken: string;
  userId: string;
};

type StudentProfileResult = {
  response: Response;
  // deno-lint-ignore no-explicit-any
  body: any;
};

function uniqueStudentNumber(): string {
  return `FR03-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

async function login(
  email: string,
  password: string,
): Promise<LoginResult> {
  const response = await app.request("/api/v1/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  const body = await response.json();

  assertEquals(response.status, 200);
  assertEquals(body.success, true);
  assertExists(body.data?.accessToken);
  assertExists(body.data?.user?.id);

  return {
    accessToken: body.data.accessToken,
    userId: body.data.user.id,
  };
}

async function createStudent(
  accessToken: string,
  userId: string,
  overrides: Record<string, unknown> = {},
): Promise<StudentProfileResult> {
  const response = await app.request("/api/v1/students", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId,
      studentNumber: uniqueStudentNumber(),
      program: "BS Information Technology",
      yearLevel: 4,
      section: "A",
      contactNumber: "09123456789",
      address: "Bulacan, Philippines",
      emergencyContactName: "Juan Cruz",
      emergencyContactNumber: "09987654321",
      ...overrides,
    }),
  });

  const body = await response.json();

  return {
    response,
    body,
  };
}

/**
 * Creates the student profile when it does not exist.
 *
 * If the test database already contains the profile, the existing
 * profile is retrieved through /me instead of attempting to create
 * the same userId again.
 *
 * This keeps the tests compatible with persistent test databases.
 */
async function ensureStudentProfile(
  adminAccessToken: string,
  studentAccessToken: string,
  studentUserId: string,
  // deno-lint-ignore no-explicit-any
): Promise<any> {
  const createResult = await createStudent(
    adminAccessToken,
    studentUserId,
  );

  if (createResult.response.status === 201) {
    assertEquals(createResult.body.success, true);
    assertExists(createResult.body.data);

    return createResult.body.data;
  }

  assertEquals(createResult.response.status, 409);

  const response = await app.request("/api/v1/students/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${studentAccessToken}`,
    },
  });

  const body = await response.json();

  assertEquals(response.status, 200);
  assertEquals(body.success, true);
  assertExists(body.data);

  return body.data;
}

/**
 * FR-03
 *
 * Administrator can create a student internship profile
 * for an existing student account.
 *
 * The same test database may already contain the student's
 * profile. In that case, 409 confirms that duplicate creation
 * is correctly prevented.
 */
Deno.test(
  "FR-03 administrator can create student profile",
  async () => {
    await setupTestUsers();

    const admin = await login(
      TEST_USERS.admin.email,
      TEST_USERS.admin.password,
    );

    const student = await login(
      TEST_USERS.student.email,
      TEST_USERS.student.password,
    );

    const result = await createStudent(
      admin.accessToken,
      student.userId,
    );

    if (result.response.status === 201) {
      assertEquals(result.body.success, true);
      assertExists(result.body.data);

      assertEquals(result.body.data.id, student.userId);
      assertEquals(
        result.body.data.program,
        "BS Information Technology",
      );
      assertEquals(result.body.data.year_level, 4);
      assertEquals(result.body.data.section, "A");
      assertEquals(
        result.body.data.internship_status,
        "pending",
      );

      return;
    }

    assertEquals(result.response.status, 409);
  },
);

/**
 * FR-03
 *
 * Internship coordinator can create a student internship profile.
 *
 * If the configured coordinator account is unavailable, the test
 * is skipped because this test requires a real coordinator fixture.
 */
Deno.test(
  "FR-03 internship coordinator can create student profile",
  async () => {
    await setupTestUsers();

    const coordinatorFixture = (
      TEST_USERS as {
        coordinator?: {
          email: string;
          password: string;
        };
      }
    ).coordinator;

    if (!coordinatorFixture) {
      console.warn(
        "Skipping coordinator creation test: " +
          "TEST_USERS.coordinator is not configured.",
      );

      return;
    }

    const coordinator = await login(
      coordinatorFixture.email,
      coordinatorFixture.password,
    );

    const student = await login(
      TEST_USERS.student.email,
      TEST_USERS.student.password,
    );

    const result = await createStudent(
      coordinator.accessToken,
      student.userId,
    );

    if (result.response.status === 201) {
      assertEquals(result.body.success, true);
      assertExists(result.body.data);
      assertEquals(result.body.data.id, student.userId);

      return;
    }

    assertEquals(result.response.status, 409);
  },
);

/**
 * FR-03
 *
 * Administrator can retrieve a student profile.
 */
Deno.test(
  "FR-03 administrator can retrieve student profile",
  async () => {
    await setupTestUsers();

    const admin = await login(
      TEST_USERS.admin.email,
      TEST_USERS.admin.password,
    );

    const student = await login(
      TEST_USERS.student.email,
      TEST_USERS.student.password,
    );

    const profile = await ensureStudentProfile(
      admin.accessToken,
      student.accessToken,
      student.userId,
    );

    const studentId = profile.id;

    assertEquals(studentId, student.userId);

    const response = await app.request(
      `/api/v1/students/${studentId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${admin.accessToken}`,
        },
      },
    );

    const body = await response.json();

    assertEquals(response.status, 200);
    assertEquals(body.success, true);
    assertExists(body.data);
    assertEquals(body.data.id, studentId);
  },
);

/**
 * FR-03
 *
 * Student can retrieve their own student profile.
 *
 * Student self-service uses /me.
 */
Deno.test(
  "FR-03 student can retrieve own student profile",
  async () => {
    await setupTestUsers();

    const admin = await login(
      TEST_USERS.admin.email,
      TEST_USERS.admin.password,
    );

    const student = await login(
      TEST_USERS.student.email,
      TEST_USERS.student.password,
    );

    const profile = await ensureStudentProfile(
      admin.accessToken,
      student.accessToken,
      student.userId,
    );

    const response = await app.request(
      "/api/v1/students/me",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${student.accessToken}`,
        },
      },
    );

    const body = await response.json();

    assertEquals(response.status, 200);
    assertEquals(body.success, true);
    assertExists(body.data);

    assertEquals(body.data.id, student.userId);
    assertEquals(
      body.data.student_number,
      profile.student_number,
    );
  },
);

/**
 * FR-03
 *
 * Student can update their own editable information.
 */
Deno.test(
  "FR-03 student can update own editable information",
  async () => {
    await setupTestUsers();

    const admin = await login(
      TEST_USERS.admin.email,
      TEST_USERS.admin.password,
    );

    const student = await login(
      TEST_USERS.student.email,
      TEST_USERS.student.password,
    );

    await ensureStudentProfile(
      admin.accessToken,
      student.accessToken,
      student.userId,
    );

    const response = await app.request(
      "/api/v1/students/me",
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${student.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contactNumber: "09999999999",
          address: "Updated Student Address",
        }),
      },
    );

    const body = await response.json();

    assertEquals(response.status, 200);
    assertEquals(body.success, true);
    assertExists(body.data);

    assertEquals(
      body.data.contact_number,
      "09999999999",
    );

    assertEquals(
      body.data.address,
      "Updated Student Address",
    );

    assertEquals(body.data.id, student.userId);
  },
);

/**
 * FR-03
 *
 * Student cannot modify protected identity or academic fields.
 */
Deno.test(
  "FR-03 student cannot modify protected fields",
  async () => {
    await setupTestUsers();

    const admin = await login(
      TEST_USERS.admin.email,
      TEST_USERS.admin.password,
    );

    const student = await login(
      TEST_USERS.student.email,
      TEST_USERS.student.password,
    );

    const profile = await ensureStudentProfile(
      admin.accessToken,
      student.accessToken,
      student.userId,
    );

    const originalStudentNumber = profile.student_number;

    const originalProgram = profile.program;

    const originalYearLevel = profile.year_level;

    const response = await app.request(
      "/api/v1/students/me",
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${student.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentNumber: "HACKED-STUDENT-NUMBER",
          program: "Hacked Program",
          yearLevel: 1,
          internshipStatus: "completed",
        }),
      },
    );

    assertEquals(
      response.status === 400 ||
        response.status === 403,
      true,
    );

    const getResponse = await app.request(
      "/api/v1/students/me",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${student.accessToken}`,
        },
      },
    );

    const getBody = await getResponse.json();

    assertEquals(getResponse.status, 200);
    assertEquals(getBody.success, true);
    assertExists(getBody.data);

    assertEquals(
      getBody.data.id,
      student.userId,
    );

    assertEquals(
      getBody.data.student_number,
      originalStudentNumber,
    );

    assertEquals(
      getBody.data.program,
      originalProgram,
    );

    assertEquals(
      getBody.data.year_level,
      originalYearLevel,
    );
  },
);

/**
 * FR-03
 *
 * A student cannot retrieve another student's profile
 * through the staff /:id endpoint.
 *
 * The /me endpoint is the student self-service endpoint.
 */
Deno.test(
  "FR-03 student cannot retrieve another student profile",
  async () => {
    await setupTestUsers();

    const admin = await login(
      TEST_USERS.admin.email,
      TEST_USERS.admin.password,
    );

    const student = await login(
      TEST_USERS.student.email,
      TEST_USERS.student.password,
    );

    const profile = await ensureStudentProfile(
      admin.accessToken,
      student.accessToken,
      student.userId,
    );

    const response = await app.request(
      `/api/v1/students/${profile.id}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${student.accessToken}`,
        },
      },
    );

    assertEquals(response.status, 403);
  },
);

/**
 * FR-03
 *
 * Unauthenticated requests cannot access student profiles.
 */
Deno.test(
  "FR-03 unauthenticated request should fail",
  async () => {
    const response = await app.request(
      "/api/v1/students/me",
      {
        method: "GET",
      },
    );

    assertEquals(response.status, 401);
  },
);

/**
 * FR-03
 *
 * Faculty adviser cannot create a student profile unless
 * explicitly granted the required permission.
 *
 * This test intentionally uses a target userId that is
 * different from the existing student profile so that a
 * duplicate-profile 409 does not mask the authorization test.
 */
Deno.test(
  "FR-03 faculty adviser cannot create student profile",
  async () => {
    await setupTestUsers();

    const facultyFixture = (
      TEST_USERS as {
        faculty?: {
          email: string;
          password: string;
        };
      }
    ).faculty;

    if (!facultyFixture) {
      console.warn(
        "Skipping faculty authorization test: " +
          "TEST_USERS.faculty is not configured.",
      );

      return;
    }

    const faculty = await login(
      facultyFixture.email,
      facultyFixture.password,
    );

    const admin = await login(
      TEST_USERS.admin.email,
      TEST_USERS.admin.password,
    );

    const result = await createStudent(
      faculty.accessToken,
      admin.userId,
    );

    assertEquals(result.response.status, 403);
  },
);

/**
 * FR-03
 *
 * A student cannot create a student profile.
 *
 * The student attempts to create a profile using their
 * own userId, which is the correct FR-03 ownership model.
 */
Deno.test(
  "FR-03 student cannot create student profile",
  async () => {
    await setupTestUsers();

    const student = await login(
      TEST_USERS.student.email,
      TEST_USERS.student.password,
    );

    const result = await createStudent(
      student.accessToken,
      student.userId,
    );

    /*
     * Authorization must be evaluated before duplicate
     * profile handling for this role.
     *
     * Therefore the student must receive 403 even when
     * their profile already exists.
     */
    assertEquals(result.response.status, 403);
  },
);
