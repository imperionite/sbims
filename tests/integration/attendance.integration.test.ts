import { assertEquals, assertExists } from "@std/assert";

import { createApp } from "../../src/app.ts";
import { createSupabaseClients } from "../../src/lib/supabase.ts";
import { loadEnv } from "../../src/config/env.ts";
import { getDenoEnv } from "../../src/config/runtime.ts";

import { setupTestUsers } from "../helpers/test-user.setup.ts";
import { TEST_USERS } from "../fixtures/test-users.ts";

const env = loadEnv(getDenoEnv());

const app = createApp(env);
const { supabaseAdmin } = createSupabaseClients(env);

async function login(
  email: string = TEST_USERS.admin.email,
  password: string = TEST_USERS.admin.password,
) {
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

  return {
    response,
    body,
  };
}

async function authenticatedRequest(
  path: string,
  token: string,
  options: RequestInit = {},
) {
  return await app.request(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });
}

async function getTestUserId(email: string) {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers();

  if (error) {
    throw error;
  }

  const user = data.users.find(
    (item) => item.email?.toLowerCase() === email.toLowerCase(),
  );

  if (!user) {
    throw new Error(`Test user not found: ${email}`);
  }

  return user.id;
}

async function ensureTestStudentProfile() {
  const studentId = await getTestUserId(TEST_USERS.student.email);

  // Remove previous internship assignments.
  const { error: internshipError } = await supabaseAdmin
    .from("internships")
    .delete()
    .eq("student_id", studentId);

  if (internshipError) {
    throw internshipError;
  }

  const { data, error } = await supabaseAdmin
    .from("student_profiles")
    .upsert(
      {
        id: studentId,
        student_number: `FR07-${crypto.randomUUID()}`,
        program: "BSIT",
        year_level: 4,
        section: "A",
        contact_number: "09171234567",
        address: "Test Address, Bulacan",
        emergency_contact_name: "Test Emergency Contact",
        emergency_contact_number: "09179876543",
      },
      {
        onConflict: "id",
      },
    )
    .select(
      `
          id,
          student_number,
          program,
          year_level,
          section
        `,
    )
    .single();

  if (error || !data) {
    throw error ?? new Error("Unable to create test student profile.");
  }

  return data;
}

async function createTestHte(token: string) {
  const response = await authenticatedRequest("/api/v1/htes", token, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      companyName: `FR07 Test HTE ${crypto.randomUUID()}`,
      address: "Test Address, Bulacan",
      contactPerson: "Test Contact Person",
      contactEmail: "contact@example.com",
      contactNumber: "09171234567",
    }),
  });

  const body = await response.json();

  assertEquals(response.status, 201);
  assertEquals(body.success, true);
  assertExists(body.data);

  return body.data;
}

async function createTestInternship(
  token: string,
  studentId: string,
  hteId: string,
) {
  const response = await authenticatedRequest("/api/v1/internships", token, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      studentId,
      hteId,
    }),
  });

  const body = await response.json();

  assertEquals(response.status, 201);
  assertEquals(body.success, true);
  assertExists(body.data);

  return body.data;
}

async function activateInternship(token: string, internshipId: string) {
  const response = await authenticatedRequest(
    `/api/v1/internships/${internshipId}/status`,
    token,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "active",
      }),
    },
  );

  const body = await response.json();

  assertEquals(response.status, 200);
  assertEquals(body.success, true);
  assertEquals(body.data.status, "active");

  return body.data;
}

async function createActiveInternship() {
  await setupTestUsers();

  const student = await ensureTestStudentProfile();

  const { response: loginResponse, body: loginBody } = await login();

  assertEquals(loginResponse.status, 200);

  const hte = await createTestHte(loginBody.data.accessToken);

  const internship = await createTestInternship(
    loginBody.data.accessToken,
    student.id,
    hte.id,
  );

  await activateInternship(loginBody.data.accessToken, internship.id);

  return {
    student,
    internship,
    adminToken: loginBody.data.accessToken,
  };
}

/*
 * ---------------------------------------------------------
 * CREATE
 * ---------------------------------------------------------
 */

Deno.test("FR-07 student can create attendance", async () => {
  const { student, internship } = await createActiveInternship();

  const { response, body } = await login(
    TEST_USERS.student.email,
    TEST_USERS.student.password,
  );

  assertEquals(response.status, 200);

  const attendanceResponse = await authenticatedRequest(
    "/api/v1/attendance",
    body.data.accessToken,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        internship_id: internship.id,
        attendance_date: "2026-08-10",
        time_in: "08:00:00",
        time_out: "17:00:00",
      }),
    },
  );

  const attendance = await attendanceResponse.json();

  assertEquals(attendanceResponse.status, 201);
  assertEquals(attendance.success, true);
  assertExists(attendance.data);

  assertEquals(attendance.data.internship_id, internship.id);
  assertEquals(attendance.data.validation_status, "pending");
  assertEquals(attendance.data.validated_by, null);
  assertEquals(attendance.data.validated_at, null);

  assertEquals(student.id, internship.student_id);
});

/*
 * ---------------------------------------------------------
 * STUDENT RETRIEVAL
 * ---------------------------------------------------------
 */

Deno.test("FR-07 student can retrieve own attendance", async () => {
  const { internship } = await createActiveInternship();

  const { response: loginResponse, body: loginBody } = await login(
    TEST_USERS.student.email,
    TEST_USERS.student.password,
  );

  assertEquals(loginResponse.status, 200);

  const createResponse = await authenticatedRequest(
    "/api/v1/attendance",
    loginBody.data.accessToken,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        internship_id: internship.id,
        attendance_date: "2026-08-10",
        time_in: "08:00:00",
        time_out: "17:00:00",
      }),
    },
  );

  assertEquals(createResponse.status, 201);

  const response = await authenticatedRequest(
    "/api/v1/attendance/me",
    loginBody.data.accessToken,
  );

  const body = await response.json();

  assertEquals(response.status, 200);
  assertEquals(body.success, true);
  assertExists(body.data);
  assertEquals(body.data.length, 1);
  assertEquals(body.data[0].internship_id, internship.id);
});

/*
 * ---------------------------------------------------------
 * UPDATE
 * ---------------------------------------------------------
 */

Deno.test("FR-07 student can update pending attendance", async () => {
  const { internship } = await createActiveInternship();

  const { response: loginResponse, body: loginBody } = await login(
    TEST_USERS.student.email,
    TEST_USERS.student.password,
  );

  assertEquals(loginResponse.status, 200);

  const createResponse = await authenticatedRequest(
    "/api/v1/attendance",
    loginBody.data.accessToken,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        internship_id: internship.id,
        attendance_date: "2026-08-10",
        time_in: "08:00:00",
        time_out: "17:00:00",
      }),
    },
  );

  const createBody = await createResponse.json();

  assertEquals(createResponse.status, 201);

  const attendanceId = createBody.data.id;

  const updateResponse = await authenticatedRequest(
    `/api/v1/attendance/${attendanceId}`,
    loginBody.data.accessToken,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        time_in: "08:30:00",
        time_out: "17:30:00",
      }),
    },
  );

  const updateBody = await updateResponse.json();

  assertEquals(updateResponse.status, 200);
  assertEquals(updateBody.success, true);
  assertEquals(updateBody.data.time_in, "08:30:00");
  assertEquals(updateBody.data.time_out, "17:30:00");
  assertEquals(updateBody.data.validation_status, "pending");
});

/*
 * ---------------------------------------------------------
 * DUPLICATE
 * ---------------------------------------------------------
 */

Deno.test(
  "FR-07 student cannot create duplicate attendance for the same date",
  async () => {
    const { internship } = await createActiveInternship();

    const { response: loginResponse, body: loginBody } = await login(
      TEST_USERS.student.email,
      TEST_USERS.student.password,
    );

    assertEquals(loginResponse.status, 200);

    const payload = {
      internship_id: internship.id,
      attendance_date: "2026-08-10",
      time_in: "08:00:00",
      time_out: "17:00:00",
    };

    const firstResponse = await authenticatedRequest(
      "/api/v1/attendance",
      loginBody.data.accessToken,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    assertEquals(firstResponse.status, 201);

    const secondResponse = await authenticatedRequest(
      "/api/v1/attendance",
      loginBody.data.accessToken,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    assertEquals(secondResponse.status, 409);
  },
);

/*
 * ---------------------------------------------------------
 * VALIDATION
 * ---------------------------------------------------------
 */

Deno.test("FR-07 internship coordinator can validate attendance", async () => {
  const { internship } = await createActiveInternship();

  const { response: studentLoginResponse, body: studentLoginBody } = await login(
    TEST_USERS.student.email,
    TEST_USERS.student.password,
  );

  assertEquals(studentLoginResponse.status, 200);

  const createResponse = await authenticatedRequest(
    "/api/v1/attendance",
    studentLoginBody.data.accessToken,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        internship_id: internship.id,
        attendance_date: "2026-08-10",
        time_in: "08:00:00",
        time_out: "17:00:00",
      }),
    },
  );

  const createBody = await createResponse.json();

  assertEquals(createResponse.status, 201);

  const coordinatorLogin = await login(
    TEST_USERS.coordinator.email,
    TEST_USERS.coordinator.password,
  );

  assertEquals(coordinatorLogin.response.status, 200);

  const response = await authenticatedRequest(
    `/api/v1/attendance/${createBody.data.id}/validation`,
    coordinatorLogin.body.data.accessToken,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        validation_status: "validated",
      }),
    },
  );

  const body = await response.json();

  assertEquals(response.status, 200);
  assertEquals(body.success, true);
  assertEquals(body.data.validation_status, "validated");
  assertEquals(
    body.data.validated_by,
    await getTestUserId(TEST_USERS.coordinator.email),
  );
  assertExists(body.data.validated_at);
});

/*
 * ---------------------------------------------------------
 * REJECTION
 * ---------------------------------------------------------
 */

Deno.test("FR-07 internship coordinator can reject attendance", async () => {
  const { internship } = await createActiveInternship();

  const { response: studentLoginResponse, body: studentLoginBody } = await login(
    TEST_USERS.student.email,
    TEST_USERS.student.password,
  );

  assertEquals(studentLoginResponse.status, 200);

  const createResponse = await authenticatedRequest(
    "/api/v1/attendance",
    studentLoginBody.data.accessToken,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        internship_id: internship.id,
        attendance_date: "2026-08-10",
        time_in: "08:00:00",
        time_out: "17:00:00",
      }),
    },
  );

  const createBody = await createResponse.json();

  const coordinatorLogin = await login(
    TEST_USERS.coordinator.email,
    TEST_USERS.coordinator.password,
  );

  assertEquals(coordinatorLogin.response.status, 200);

  const response = await authenticatedRequest(
    `/api/v1/attendance/${createBody.data.id}/validation`,
    coordinatorLogin.body.data.accessToken,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        validation_status: "rejected",
      }),
    },
  );

  const body = await response.json();

  assertEquals(response.status, 200);
  assertEquals(body.data.validation_status, "rejected");
  assertEquals(
    body.data.validated_by,
    await getTestUserId(TEST_USERS.coordinator.email),
  );
  assertExists(body.data.validated_at);
});

/*
 * ---------------------------------------------------------
 * VALIDATED RECORD CANNOT BE UPDATED
 * ---------------------------------------------------------
 */

Deno.test("FR-07 student cannot update validated attendance", async () => {
  const { internship } = await createActiveInternship();

  const studentLogin = await login(
    TEST_USERS.student.email,
    TEST_USERS.student.password,
  );

  assertEquals(studentLogin.response.status, 200);

  const createResponse = await authenticatedRequest(
    "/api/v1/attendance",
    studentLogin.body.data.accessToken,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        internship_id: internship.id,
        attendance_date: "2026-08-10",
        time_in: "08:00:00",
        time_out: "17:00:00",
      }),
    },
  );

  const createBody = await createResponse.json();

  const coordinatorLogin = await login(
    TEST_USERS.coordinator.email,
    TEST_USERS.coordinator.password,
  );

  assertEquals(coordinatorLogin.response.status, 200);

  const validationResponse = await authenticatedRequest(
    `/api/v1/attendance/${createBody.data.id}/validation`,
    coordinatorLogin.body.data.accessToken,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        validation_status: "validated",
      }),
    },
  );

  assertEquals(validationResponse.status, 200);

  const updateResponse = await authenticatedRequest(
    `/api/v1/attendance/${createBody.data.id}`,
    studentLogin.body.data.accessToken,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        time_in: "09:00:00",
        time_out: "18:00:00",
      }),
    },
  );

  assertEquals(updateResponse.status, 400);
});

/*
 * ---------------------------------------------------------
 * RENDERED HOURS
 * ---------------------------------------------------------
 */

Deno.test("FR-07 rendered hours count only validated attendance", async () => {
  const { internship } = await createActiveInternship();

  const studentLogin = await login(
    TEST_USERS.student.email,
    TEST_USERS.student.password,
  );

  assertEquals(studentLogin.response.status, 200);

  const coordinatorLogin = await login(
    TEST_USERS.coordinator.email,
    TEST_USERS.coordinator.password,
  );

  assertEquals(coordinatorLogin.response.status, 200);

  const dates = ["2026-08-10", "2026-08-11"];

  const attendanceIds: string[] = [];

  for (const date of dates) {
    const response = await authenticatedRequest(
      "/api/v1/attendance",
      studentLogin.body.data.accessToken,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          internship_id: internship.id,
          attendance_date: date,
          time_in: "08:00:00",
          time_out: "17:00:00",
        }),
      },
    );

    const body = await response.json();

    assertEquals(response.status, 201);

    attendanceIds.push(body.data.id);
  }

  // Validate only the first day.
  const validationResponse = await authenticatedRequest(
    `/api/v1/attendance/${attendanceIds[0]}/validation`,
    coordinatorLogin.body.data.accessToken,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        validation_status: "validated",
      }),
    },
  );

  assertEquals(validationResponse.status, 200);

  const response = await authenticatedRequest(
    `/api/v1/attendance/internship/${internship.id}/rendered-hours`,
    studentLogin.body.data.accessToken,
  );

  const body = await response.json();

  assertEquals(response.status, 200);
  assertEquals(body.success, true);

  // 08:00 -> 17:00 = 9 hours.
  // Less 1-hour break = 8 rendered hours.
  assertEquals(body.data.totalHours, 8);
});

/*
 * ---------------------------------------------------------
 * AUTHORIZATION
 * ---------------------------------------------------------
 */

Deno.test("FR-07 unauthenticated attendance request should fail", async () => {
  const response = await app.request("/api/v1/attendance");

  assertEquals(response.status, 401);
});

Deno.test("FR-07 administrator cannot create student attendance", async () => {
  await setupTestUsers();

  const { response, body } = await login();

  assertEquals(response.status, 200);

  const response2 = await authenticatedRequest(
    "/api/v1/attendance",
    body.data.accessToken,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        internship_id: "00000000-0000-0000-0000-000000000000",
        attendance_date: "2026-08-10",
        time_in: "08:00:00",
        time_out: "17:00:00",
      }),
    },
  );

  assertEquals(response2.status, 403);
});

Deno.test("FR-07 student cannot validate attendance", async () => {
  const { internship } = await createActiveInternship();

  const studentLogin = await login(
    TEST_USERS.student.email,
    TEST_USERS.student.password,
  );

  assertEquals(studentLogin.response.status, 200);

  const createResponse = await authenticatedRequest(
    "/api/v1/attendance",
    studentLogin.body.data.accessToken,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        internship_id: internship.id,
        attendance_date: "2026-08-10",
        time_in: "08:00:00",
        time_out: "17:00:00",
      }),
    },
  );

  const createBody = await createResponse.json();

  assertEquals(createResponse.status, 201);

  const response = await authenticatedRequest(
    `/api/v1/attendance/${createBody.data.id}/validation`,
    studentLogin.body.data.accessToken,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        validation_status: "validated",
      }),
    },
  );

  assertEquals(response.status, 403);
});
