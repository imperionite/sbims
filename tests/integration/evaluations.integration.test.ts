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

  /*
   * Remove previous FR-08 test internships.
   *
   * Evaluation records are deleted automatically
   * through the internship foreign-key cascade.
   */
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
        student_number: `FR08-${crypto.randomUUID()}`,
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

async function createTestHte(token: string, companyPrefix = "FR08 Test HTE") {
  const response = await authenticatedRequest("/api/v1/htes", token, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      companyName: `${companyPrefix} ${crypto.randomUUID()}`,
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

async function assignHteSupervisor(
  token: string,
  hteId: string,
  supervisorId: string,
) {
  const response = await authenticatedRequest(
    `/api/v1/htes/${hteId}/supervisor`,
    token,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        supervisorId,
      }),
    },
  );

  const body = await response.json();

  assertEquals(response.status, 200);

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

async function createEvaluationScenario() {
  await setupTestUsers();

  const student = await ensureTestStudentProfile();

  const { response: adminLoginResponse, body: adminLoginBody } = await login();

  assertEquals(adminLoginResponse.status, 200);

  const adminToken = adminLoginBody.data.accessToken;

  const hte = await createTestHte(adminToken, "FR08 Assigned HTE");

  const hteSupervisorId = await getTestUserId(TEST_USERS.hteSupervisor.email);

  await assignHteSupervisor(adminToken, hte.id, hteSupervisorId);

  const internship = await createTestInternship(adminToken, student.id, hte.id);

  await activateInternship(adminToken, internship.id);

  return {
    student,
    hte,
    internship,
    adminToken,
    hteSupervisorId,
  };
}

/*
 * ---------------------------------------------------------
 * CREATE
 * ---------------------------------------------------------
 */

Deno.test(
  "FR-08 HTE Supervisor can create an evaluation for assigned intern",
  async () => {
    const { internship } = await createEvaluationScenario();

    const { response, body } = await login(
      TEST_USERS.hteSupervisor.email,
      TEST_USERS.hteSupervisor.password,
    );

    assertEquals(response.status, 200);

    const evaluationResponse = await authenticatedRequest(
      "/api/v1/evaluations",
      body.data.accessToken,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          internship_id: internship.id,
          evaluation_type: "hte_supervisor",
          responses: {
            criterion_1: 5,
            criterion_2: 4,
            criterion_3: 5,
          },
          comments: "Good performance during internship.",
        }),
      },
    );

    const evaluation = await evaluationResponse.json();

    assertEquals(evaluationResponse.status, 201);

    assertEquals(evaluation.success, true);

    assertExists(evaluation.data);

    assertEquals(evaluation.data.internship_id, internship.id);

    assertEquals(evaluation.data.evaluator_id, body.data.user.id);

    assertEquals(evaluation.data.evaluation_type, "hte_supervisor");

    assertEquals(evaluation.data.status, "draft");
  },
);

/*
 * ---------------------------------------------------------
 * AUTHORIZATION
 * ---------------------------------------------------------
 */

Deno.test(
  "FR-08 unrelated HTE Supervisor cannot create an evaluation",
  async () => {
    const { internship } = await createEvaluationScenario();

    const { response, body } = await login(
      TEST_USERS.otherHteSupervisor.email,
      TEST_USERS.otherHteSupervisor.password,
    );

    assertEquals(response.status, 200);

    const evaluationResponse = await authenticatedRequest(
      "/api/v1/evaluations",
      body.data.accessToken,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          internship_id: internship.id,
          responses: {
            criterion_1: 5,
          },
        }),
      },
    );

    assertEquals(evaluationResponse.status, 403);
  },
);

/*
 * ---------------------------------------------------------
 * RETRIEVAL
 * ---------------------------------------------------------
 */

Deno.test(
  "FR-08 assigned HTE Supervisor can retrieve own evaluations",
  async () => {
    const { internship } = await createEvaluationScenario();

    const { response: loginResponse, body: loginBody } = await login(
      TEST_USERS.hteSupervisor.email,
      TEST_USERS.hteSupervisor.password,
    );

    assertEquals(loginResponse.status, 200);

    const createResponse = await authenticatedRequest(
      "/api/v1/evaluations",
      loginBody.data.accessToken,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          internship_id: internship.id,
          responses: {
            criterion_1: 5,
            criterion_2: 4,
          },
        }),
      },
    );

    assertEquals(createResponse.status, 201);

    const response = await authenticatedRequest(
      "/api/v1/evaluations/me",
      loginBody.data.accessToken,
    );

    const body = await response.json();

    assertEquals(response.status, 200);

    assertEquals(body.success, true);

    assertExists(body.data);

    assertEquals(body.data.length, 1);

    assertEquals(body.data[0].internship_id, internship.id);
  },
);

Deno.test("FR-08 student can retrieve submitted evaluation", async () => {
  const { internship } = await createEvaluationScenario();

  const { response: supervisorLoginResponse, body: supervisorLoginBody } = await login(
    TEST_USERS.hteSupervisor.email,
    TEST_USERS.hteSupervisor.password,
  );

  assertEquals(supervisorLoginResponse.status, 200);

  const createResponse = await authenticatedRequest(
    "/api/v1/evaluations",
    supervisorLoginBody.data.accessToken,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        internship_id: internship.id,
        responses: {
          criterion_1: 5,
          criterion_2: 4,
        },
      }),
    },
  );

  const createBody = await createResponse.json();

  assertEquals(createResponse.status, 201);

  const evaluationId = createBody.data.id;

  const submitResponse = await authenticatedRequest(
    `/api/v1/evaluations/${evaluationId}/submit`,
    supervisorLoginBody.data.accessToken,
    {
      method: "POST",
    },
  );

  assertEquals(submitResponse.status, 200);

  const { response: studentLoginResponse, body: studentLoginBody } = await login(
    TEST_USERS.student.email,
    TEST_USERS.student.password,
  );

  assertEquals(studentLoginResponse.status, 200);

  const response = await authenticatedRequest(
    `/api/v1/evaluations/${evaluationId}`,
    studentLoginBody.data.accessToken,
  );

  const body = await response.json();

  assertEquals(response.status, 200);

  assertEquals(body.success, true);

  assertEquals(body.data.id, evaluationId);

  assertEquals(body.data.status, "submitted");
});

/*
 * ---------------------------------------------------------
 * UPDATE
 * ---------------------------------------------------------
 */

Deno.test("FR-08 HTE Supervisor can update own draft evaluation", async () => {
  const { internship } = await createEvaluationScenario();

  const { response: loginResponse, body: loginBody } = await login(
    TEST_USERS.hteSupervisor.email,
    TEST_USERS.hteSupervisor.password,
  );

  assertEquals(loginResponse.status, 200);

  const createResponse = await authenticatedRequest(
    "/api/v1/evaluations",
    loginBody.data.accessToken,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        internship_id: internship.id,
        responses: {
          criterion_1: 4,
        },
      }),
    },
  );

  const createBody = await createResponse.json();

  assertEquals(createResponse.status, 201);

  const evaluationId = createBody.data.id;

  const response = await authenticatedRequest(
    `/api/v1/evaluations/${evaluationId}`,
    loginBody.data.accessToken,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        responses: {
          criterion_1: 5,
          criterion_2: 5,
        },
        comments: "Updated evaluation.",
      }),
    },
  );

  const body = await response.json();

  assertEquals(response.status, 200);

  assertEquals(body.success, true);

  assertEquals(body.data.status, "draft");

  assertEquals(body.data.responses.criterion_1, 5);
});

/*
 * ---------------------------------------------------------
 * SUBMISSION
 * ---------------------------------------------------------
 */

Deno.test("FR-08 HTE Supervisor can submit evaluation", async () => {
  const { internship } = await createEvaluationScenario();

  const { response: loginResponse, body: loginBody } = await login(
    TEST_USERS.hteSupervisor.email,
    TEST_USERS.hteSupervisor.password,
  );

  assertEquals(loginResponse.status, 200);

  const createResponse = await authenticatedRequest(
    "/api/v1/evaluations",
    loginBody.data.accessToken,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        internship_id: internship.id,
        responses: {
          criterion_1: 5,
          criterion_2: 4,
          criterion_3: 5,
        },
      }),
    },
  );

  const createBody = await createResponse.json();

  assertEquals(createResponse.status, 201);

  const evaluationId = createBody.data.id;

  const submitResponse = await authenticatedRequest(
    `/api/v1/evaluations/${evaluationId}/submit`,
    loginBody.data.accessToken,
    {
      method: "POST",
    },
  );

  const submitBody = await submitResponse.json();

  assertEquals(submitResponse.status, 200);

  assertEquals(submitBody.success, true);

  assertEquals(submitBody.data.status, "submitted");

  assertExists(submitBody.data.submitted_at);
});

Deno.test("FR-08 submitted evaluation cannot be submitted again", async () => {
  const { internship } = await createEvaluationScenario();

  const { response: loginResponse, body: loginBody } = await login(
    TEST_USERS.hteSupervisor.email,
    TEST_USERS.hteSupervisor.password,
  );

  assertEquals(loginResponse.status, 200);

  const createResponse = await authenticatedRequest(
    "/api/v1/evaluations",
    loginBody.data.accessToken,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        internship_id: internship.id,
        responses: {
          criterion_1: 5,
        },
      }),
    },
  );

  const createBody = await createResponse.json();

  assertEquals(createResponse.status, 201);

  const evaluationId = createBody.data.id;

  const firstSubmitResponse = await authenticatedRequest(
    `/api/v1/evaluations/${evaluationId}/submit`,
    loginBody.data.accessToken,
    {
      method: "POST",
    },
  );

  assertEquals(firstSubmitResponse.status, 200);

  const secondSubmitResponse = await authenticatedRequest(
    `/api/v1/evaluations/${evaluationId}/submit`,
    loginBody.data.accessToken,
    {
      method: "POST",
    },
  );

  assertEquals(secondSubmitResponse.status, 400);
});

/*
 * ---------------------------------------------------------
 * RBAC
 * ---------------------------------------------------------
 */

Deno.test("FR-08 student cannot create an evaluation", async () => {
  await setupTestUsers();

  const { response, body } = await login(
    TEST_USERS.student.email,
    TEST_USERS.student.password,
  );

  assertEquals(response.status, 200);

  const evaluationResponse = await authenticatedRequest(
    "/api/v1/evaluations",
    body.data.accessToken,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        internship_id: crypto.randomUUID(),
        responses: {
          criterion_1: 5,
        },
      }),
    },
  );

  assertEquals(evaluationResponse.status, 403);
});

Deno.test("FR-08 unauthenticated request is rejected", async () => {
  const response = await app.request("/api/v1/evaluations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      internship_id: crypto.randomUUID(),
      responses: {
        criterion_1: 5,
      },
    }),
  });

  assertEquals(response.status, 401);
});
