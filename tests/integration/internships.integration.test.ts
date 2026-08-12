import { assertEquals, assertExists } from "@std/assert";

import { app } from "../../src/app.ts";
import { supabaseAdmin } from "../../src/lib/supabase.ts";

import { setupTestUsers } from "../helpers/test-user.setup.ts";
import { TEST_USERS } from "../fixtures/test-users.ts";

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
        student_number: `FR05-${crypto.randomUUID()}`,
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
      companyName: `FR05 Test HTE ${crypto.randomUUID()}`,
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

Deno.test("FR-05 administrator can list internships", async () => {
  await setupTestUsers();

  await ensureTestStudentProfile();

  const { response: loginResponse, body: loginBody } = await login();

  assertEquals(loginResponse.status, 200);

  const response = await authenticatedRequest(
    "/api/v1/internships",
    loginBody.data.accessToken,
  );

  const body = await response.json();

  assertEquals(response.status, 200);
  assertEquals(body.success, true);
  assertExists(body.data);
});

Deno.test(
  "FR-05 administrator can create an internship assignment",
  async () => {
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

    assertExists(internship.id);
    assertEquals(internship.student_id, student.id);
    assertEquals(internship.hte_id, hte.id);
    assertEquals(internship.status, "pending");
    assertExists(internship.created_at);
    assertExists(internship.updated_at);
  },
);

Deno.test("FR-05 administrator can retrieve an internship", async () => {
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

  const response = await authenticatedRequest(
    `/api/v1/internships/${internship.id}`,
    loginBody.data.accessToken,
  );

  const body = await response.json();

  assertEquals(response.status, 200);
  assertEquals(body.success, true);
  assertEquals(body.data.id, internship.id);
});

Deno.test("FR-05 student can retrieve own internship", async () => {
  await setupTestUsers();

  const student = await ensureTestStudentProfile();

  const { response: adminLoginResponse, body: adminLoginBody } = await login();

  assertEquals(adminLoginResponse.status, 200);

  const hte = await createTestHte(adminLoginBody.data.accessToken);

  const internship = await createTestInternship(
    adminLoginBody.data.accessToken,
    student.id,
    hte.id,
  );

  const { response: studentLoginResponse, body: studentLoginBody } = await login(
    TEST_USERS.student.email,
    TEST_USERS.student.password,
  );

  assertEquals(studentLoginResponse.status, 200);

  const response = await authenticatedRequest(
    "/api/v1/internships/me",
    studentLoginBody.data.accessToken,
  );

  const body = await response.json();

  assertEquals(response.status, 200);
  assertEquals(body.success, true);
  assertEquals(body.data.id, internship.id);
  assertEquals(body.data.student_id, student.id);
});

Deno.test(
  "FR-05 administrator can update required internship hours",
  async () => {
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

    const response = await authenticatedRequest(
      `/api/v1/internships/${internship.id}`,
      loginBody.data.accessToken,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requiredHours: 486,
        }),
      },
    );

    const body = await response.json();

    assertEquals(response.status, 200);
    assertEquals(body.success, true);
    assertEquals(body.data.id, internship.id);
    assertEquals(body.data.required_hours, 486);
  },
);

Deno.test(
  "FR-05 administrator can change internship HTE assignment",
  async () => {
    await setupTestUsers();

    const student = await ensureTestStudentProfile();

    const { response: loginResponse, body: loginBody } = await login();

    assertEquals(loginResponse.status, 200);

    const firstHte = await createTestHte(loginBody.data.accessToken);

    const secondHte = await createTestHte(loginBody.data.accessToken);

    const internship = await createTestInternship(
      loginBody.data.accessToken,
      student.id,
      firstHte.id,
    );

    const response = await authenticatedRequest(
      `/api/v1/internships/${internship.id}`,
      loginBody.data.accessToken,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          hteId: secondHte.id,
        }),
      },
    );

    const body = await response.json();

    assertEquals(response.status, 200);
    assertEquals(body.success, true);
    assertEquals(body.data.id, internship.id);
    assertEquals(body.data.hte_id, secondHte.id);
  },
);

Deno.test("FR-05 student cannot update an internship assignment", async () => {
  await setupTestUsers();

  const student = await ensureTestStudentProfile();

  const { response: adminLoginResponse, body: adminLoginBody } = await login();

  assertEquals(adminLoginResponse.status, 200);

  const hte = await createTestHte(adminLoginBody.data.accessToken);

  const internship = await createTestInternship(
    adminLoginBody.data.accessToken,
    student.id,
    hte.id,
  );

  const { response: studentLoginResponse, body: studentLoginBody } = await login(
    TEST_USERS.student.email,
    TEST_USERS.student.password,
  );

  assertEquals(studentLoginResponse.status, 200);

  const response = await authenticatedRequest(
    `/api/v1/internships/${internship.id}`,
    studentLoginBody.data.accessToken,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requiredHours: 486,
      }),
    },
  );

  assertEquals(response.status, 403);
});

Deno.test(
  "FR-05 administrator can transition internship from pending to active",
  async () => {
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

    const response = await authenticatedRequest(
      `/api/v1/internships/${internship.id}/status`,
      loginBody.data.accessToken,
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
  },
);

Deno.test(
  "FR-05 administrator can transition internship from active to completed",
  async () => {
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

    const activeResponse = await authenticatedRequest(
      `/api/v1/internships/${internship.id}/status`,
      loginBody.data.accessToken,
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

    assertEquals(activeResponse.status, 200);

    const completedResponse = await authenticatedRequest(
      `/api/v1/internships/${internship.id}/status`,
      loginBody.data.accessToken,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "completed",
        }),
      },
    );

    const body = await completedResponse.json();

    assertEquals(completedResponse.status, 200);
    assertEquals(body.success, true);
    assertEquals(body.data.status, "completed");
  },
);

Deno.test("FR-05 unauthenticated internship request should fail", async () => {
  const response = await app.request("/api/v1/internships");

  assertEquals(response.status, 401);
});

Deno.test("FR-05 student cannot manage internship assignments", async () => {
  await setupTestUsers();

  const { response: loginResponse, body: loginBody } = await login(
    TEST_USERS.student.email,
    TEST_USERS.student.password,
  );

  assertEquals(loginResponse.status, 200);

  const response = await authenticatedRequest(
    "/api/v1/internships",
    loginBody.data.accessToken,
  );

  assertEquals(response.status, 403);
});

Deno.test("FR-05 student cannot create an internship assignment", async () => {
  await setupTestUsers();

  const student = await ensureTestStudentProfile();

  const { response: loginResponse, body: loginBody } = await login(
    TEST_USERS.student.email,
    TEST_USERS.student.password,
  );

  assertEquals(loginResponse.status, 200);

  const response = await authenticatedRequest(
    "/api/v1/internships",
    loginBody.data.accessToken,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        studentId: student.id,
        hteId: "00000000-0000-0000-0000-000000000000",
      }),
    },
  );

  assertEquals(response.status, 403);
});

Deno.test("FR-05 invalid internship data should be rejected", async () => {
  await setupTestUsers();

  const { response: loginResponse, body: loginBody } = await login();

  assertEquals(loginResponse.status, 200);

  const response = await authenticatedRequest(
    "/api/v1/internships",
    loginBody.data.accessToken,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        studentId: "invalid-id",
        hteId: "invalid-id",
      }),
    },
  );

  assertEquals(response.status, 400);
});

Deno.test("FR-05 missing internship fields should be rejected", async () => {
  await setupTestUsers();

  const { response: loginResponse, body: loginBody } = await login();

  assertEquals(loginResponse.status, 200);

  const response = await authenticatedRequest(
    "/api/v1/internships",
    loginBody.data.accessToken,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        studentId: "22222222-2222-2222-2222-222222222222",
      }),
    },
  );

  assertEquals(response.status, 400);
});

Deno.test("FR-05 non-existent internship should return 404", async () => {
  await setupTestUsers();

  const { response: loginResponse, body: loginBody } = await login();

  assertEquals(loginResponse.status, 200);

  const response = await authenticatedRequest(
    "/api/v1/internships/00000000-0000-0000-0000-000000000000",
    loginBody.data.accessToken,
  );

  assertEquals(response.status, 404);
});

Deno.test("FR-05 invalid status transition should be rejected", async () => {
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

  const response = await authenticatedRequest(
    `/api/v1/internships/${internship.id}/status`,
    loginBody.data.accessToken,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "completed",
      }),
    },
  );

  assertEquals(response.status, 400);
});

Deno.test("FR-05 completed internship cannot transition again", async () => {
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

  await authenticatedRequest(
    `/api/v1/internships/${internship.id}/status`,
    loginBody.data.accessToken,
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

  await authenticatedRequest(
    `/api/v1/internships/${internship.id}/status`,
    loginBody.data.accessToken,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "completed",
      }),
    },
  );

  const response = await authenticatedRequest(
    `/api/v1/internships/${internship.id}/status`,
    loginBody.data.accessToken,
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

  assertEquals(response.status, 400);
});

Deno.test(
  "FR-05 student cannot have duplicate internship assignments",
  async () => {
    await setupTestUsers();

    const student = await ensureTestStudentProfile();

    const { response: loginResponse, body: loginBody } = await login();

    assertEquals(loginResponse.status, 200);

    const hte = await createTestHte(loginBody.data.accessToken);

    await createTestInternship(loginBody.data.accessToken, student.id, hte.id);

    const secondHte = await createTestHte(loginBody.data.accessToken);

    const response = await authenticatedRequest(
      "/api/v1/internships",
      loginBody.data.accessToken,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentId: student.id,
          hteId: secondHte.id,
        }),
      },
    );

    assertEquals(response.status, 409);
  },
);
