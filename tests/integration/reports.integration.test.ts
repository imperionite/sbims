import { assertEquals, assertExists } from "@std/assert";

import { createApp } from "../../src/app.ts";
import { createSupabaseClients } from "../../src/lib/supabase.ts";
import { loadEnv } from "../../src/config/env.ts";
import { getDenoEnv } from "../../src/config/runtime.ts";

import { setupTestUsers } from "../helpers/test-user.setup.ts";
import { TEST_USERS } from "../fixtures/test-users.ts";

import { assertAuditEvent } from "../helpers/audit.assertions.ts";

// ============================================================
// Application and database setup
// ============================================================

const env = loadEnv(getDenoEnv());
const app = createApp(env);
const { supabaseAdmin } = createSupabaseClients(env);

const REPORT_STUDENT_EMAIL_PREFIX = "sbims-report-test-";

type InternshipRecord = {
  id: string;
  student_id: string;
  hte_id: string;
  faculty_adviser_id: string;
  required_hours: number | null;
  status: "pending" | "active" | "completed";
};

type ReportStudent = {
  id: string;
  email: string;
  studentNumber: string;
  program: string;
};

type ReportHte = {
  id: string;
  companyName: string;
};

type CreatedFixture = {
  studentIds: string[];
  hteIds: string[];
  internshipIds: string[];
};

// ============================================================
// HTTP helpers
// ============================================================

async function login(
  email: string = TEST_USERS.admin.email,
  password: string = TEST_USERS.admin.password,
) {
  const response = await app.request("/api/v1/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const body = await response.json();

  return { response, body };
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

async function requestReport(path: string, token: string) {
  const response = await authenticatedRequest(path, token);

  const body = await response.json();

  return { response, body };
}

// ============================================================
// Database helpers
// ============================================================

async function getTestUserId(email: string): Promise<string> {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers();

  if (error) throw error;

  const user = data.users.find(
    (item) => item.email?.toLowerCase() === email.toLowerCase(),
  );

  if (!user) {
    throw new Error(`Test user not found: ${email}`);
  }

  return user.id;
}

/**
 * Creates an isolated student fixture for this test run.
 *
 * A separate student is used for each report record because the
 * internship module restricts a student to one operational internship.
 */
async function createReportStudent(program: string): Promise<ReportStudent> {
  const email = `${REPORT_STUDENT_EMAIL_PREFIX}${crypto.randomUUID()}@maildrop.cc`;

  const password = "TestPassword2026!";

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    throw authError ?? new Error("Unable to create report test user.");
  }

  const userId = authData.user.id;
  const studentNumber = `RPT-${crypto.randomUUID()}`;

  const { error: profileError } = await supabaseAdmin.from("profiles").insert({
    id: userId,
    email,
    first_name: "Report",
    last_name: "Test Student",
    role: "student",
    is_active: true,
    must_change_password: false,
  });

  if (profileError) throw profileError;

  const { error: studentProfileError } = await supabaseAdmin
    .from("student_profiles")
    .insert({
      id: userId,
      student_number: studentNumber,
      program,
      year_level: 4,
      section: "A",
      contact_number: "09171234567",
      address: "Test Address, Bulacan",
      emergency_contact_name: "Test Emergency Contact",
      emergency_contact_number: "09179876543",
    });

  if (studentProfileError) throw studentProfileError;

  return {
    id: userId,
    email,
    studentNumber,
    program,
  };
}

async function createReportHte(token: string): Promise<ReportHte> {
  const companyName = `Report Test HTE ${crypto.randomUUID()}`;

  const response = await authenticatedRequest("/api/v1/htes", token, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      companyName,
      address: "Test Address, Bulacan",
      contactPerson: "Report Test Contact",
      contactEmail: "report-contact@example.com",
      contactNumber: "09171234567",
    }),
  });

  const body = await response.json();

  assertEquals(response.status, 201);
  assertEquals(body.success, true);
  assertExists(body.data?.id);

  return {
    id: body.data.id,
    companyName: body.data.company_name ?? companyName,
  };
}

async function createReportInternship(
  token: string,
  studentId: string,
  hteId: string,
  facultyAdviserId: string,
  requiredHours: number | null,
): Promise<InternshipRecord> {
  const response = await authenticatedRequest("/api/v1/internships", token, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      studentId,
      hteId,
      facultyAdviserId,
      startDate: "2026-01-01",
      endDate: "2027-12-31",
      requiredHours,
    }),
  });

  const body = await response.json();

  if (response.status !== 201) {
    console.error("Report internship fixture creation failed:", {
      status: response.status,
      body,
      studentId,
      hteId,
      facultyAdviserId,
      requiredHours,
    });
  }

  assertEquals(response.status, 201);
  assertEquals(body.success, true);
  assertExists(body.data?.id);

  return body.data as InternshipRecord;
}

/**
 * Sets a fixture's status directly in the test database.
 *
 * This isolates reporting tests from internship status-transition
 * business rules. The reports endpoint is being tested against
 * persisted records in each supported status.
 */
async function setInternshipStatus(
  internshipId: string,
  status: "pending" | "active" | "completed",
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("internships")
    .update({ status })
    .eq("id", internshipId);

  if (error) throw error;
}

/**
 * Inserts attendance directly as test data.
 *
 * 08:00–17:00 = 9 elapsed hours - 1-hour break = 8 rendered hours.
 */
async function createAttendance(
  internshipId: string,
  attendanceDate: string,
  validationStatus: "validated" | "pending" | "rejected",
  validatedBy: string,
): Promise<void> {
  const { error } = await supabaseAdmin.from("attendance_records").insert({
    internship_id: internshipId,
    attendance_date: attendanceDate,
    time_in: "08:00",
    time_out: "17:00",
    validation_status: validationStatus,
    validated_by: validationStatus === "pending" ? null : validatedBy,
    validated_at: validationStatus === "pending" ? null : new Date().toISOString(),
  });

  if (error) throw error;
}

async function cleanupFixtures(fixture: CreatedFixture): Promise<void> {
  // Delete internships first so dependent records can be removed
  // according to the database's configured foreign-key behavior.
  if (fixture.internshipIds.length > 0) {
    const { error } = await supabaseAdmin
      .from("internships")
      .delete()
      .in("id", fixture.internshipIds);

    if (error) throw error;
  }

  if (fixture.hteIds.length > 0) {
    const { error } = await supabaseAdmin
      .from("hte_profiles")
      .delete()
      .in("id", fixture.hteIds);

    if (error) throw error;
  }

  for (const studentId of fixture.studentIds) {
    const { error: studentProfileError } = await supabaseAdmin
      .from("student_profiles")
      .delete()
      .eq("id", studentId);

    if (studentProfileError) throw studentProfileError;

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", studentId);

    if (profileError) throw profileError;

    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(studentId);

    if (authError) throw authError;
  }
}

// ============================================================
// Report integration test
// ============================================================

Deno.test(
  "FR-10 reports integration: authentication, RBAC, filtering, aggregation, and audit logging",
  async () => {
    await setupTestUsers();

    const fixture: CreatedFixture = {
      studentIds: [],
      hteIds: [],
      internshipIds: [],
    };

    try {
      // ------------------------------------------------------
      // 1. Authenticate report users
      // ------------------------------------------------------

      const adminLogin = await login();

      assertEquals(adminLogin.response.status, 200);
      assertEquals(adminLogin.body.success, true);
      assertExists(adminLogin.body.data?.accessToken);

      const adminToken = adminLogin.body.data.accessToken;

      const coordinatorLogin = await login(
        TEST_USERS.coordinator.email,
        TEST_USERS.coordinator.password,
      );

      assertEquals(coordinatorLogin.response.status, 200);
      assertEquals(coordinatorLogin.body.success, true);

      const coordinatorToken = coordinatorLogin.body.data.accessToken;

      const studentLogin = await login(
        TEST_USERS.student.email,
        TEST_USERS.student.password,
      );

      assertEquals(studentLogin.response.status, 200);

      const studentToken = studentLogin.body.data.accessToken;

      const facultyLogin = await login(
        TEST_USERS.facultyAdviser.email,
        TEST_USERS.facultyAdviser.password,
      );

      assertEquals(facultyLogin.response.status, 200);

      const facultyToken = facultyLogin.body.data.accessToken;

      const hteLogin = await login(
        TEST_USERS.hteSupervisor.email,
        TEST_USERS.hteSupervisor.password,
      );

      assertEquals(hteLogin.response.status, 200);

      const hteToken = hteLogin.body.data.accessToken;

      // ------------------------------------------------------
      // 2. Authentication enforcement
      // ------------------------------------------------------

      const unauthenticatedList = await app.request(
        "/api/v1/reports/internships",
      );

      assertEquals(unauthenticatedList.status, 401);

      const unauthenticatedSummary = await app.request(
        "/api/v1/reports/internships/summary",
      );

      assertEquals(unauthenticatedSummary.status, 401);

      const invalidBearer = await authenticatedRequest(
        "/api/v1/reports/internships",
        "invalid-token",
      );

      assertEquals(invalidBearer.status, 401);

      // ------------------------------------------------------
      // 3. RBAC enforcement
      // ------------------------------------------------------

      for (const token of [studentToken, facultyToken, hteToken]) {
        const listResponse = await authenticatedRequest(
          "/api/v1/reports/internships",
          token,
        );

        assertEquals(listResponse.status, 403);

        const summaryResponse = await authenticatedRequest(
          "/api/v1/reports/internships/summary",
          token,
        );

        assertEquals(summaryResponse.status, 403);
      }

      // ------------------------------------------------------
      // 4. Create isolated reporting fixtures
      // ------------------------------------------------------

      const facultyAdviserId = await getTestUserId(
        TEST_USERS.facultyAdviser.email,
      );

      const adminId = await getTestUserId(TEST_USERS.admin.email);

      const studentA = await createReportStudent("BSIT");
      fixture.studentIds.push(studentA.id);

      const studentB = await createReportStudent("BSCS");
      fixture.studentIds.push(studentB.id);

      const studentC = await createReportStudent("BSIT");
      fixture.studentIds.push(studentC.id);

      const hteA = await createReportHte(adminToken);
      fixture.hteIds.push(hteA.id);

      const hteB = await createReportHte(adminToken);
      fixture.hteIds.push(hteB.id);

      const internshipA = await createReportInternship(
        adminToken,
        studentA.id,
        hteA.id,
        facultyAdviserId,
        10,
      );

      fixture.internshipIds.push(internshipA.id);

      const internshipB = await createReportInternship(
        adminToken,
        studentB.id,
        hteA.id,
        facultyAdviserId,
        12,
      );

      fixture.internshipIds.push(internshipB.id);

      const internshipC = await createReportInternship(
        adminToken,
        studentC.id,
        hteB.id,
        facultyAdviserId,
        8,
      );

      fixture.internshipIds.push(internshipC.id);

      const { error: nullableHoursError } = await supabaseAdmin
        .from("internships")
        .update({ required_hours: null })
        .eq("id", internshipC.id);

      if (nullableHoursError) throw nullableHoursError;

      await setInternshipStatus(internshipA.id, "pending");
      await setInternshipStatus(internshipB.id, "active");
      await setInternshipStatus(internshipC.id, "completed");

      // Internship A:
      // 1 validated record = 8 rendered hours.
      // 1 pending record = excluded.
      // 1 rejected record = excluded.
      await createAttendance(
        internshipA.id,
        "2026-02-01",
        "validated",
        adminId,
      );

      await createAttendance(internshipA.id, "2026-02-02", "pending", adminId);

      await createAttendance(internshipA.id, "2026-02-03", "rejected", adminId);

      // Internship B:
      // 2 validated records = 16 rendered hours.
      // Required hours = 12, so remaining hours must be zero.
      await createAttendance(
        internshipB.id,
        "2026-03-01",
        "validated",
        adminId,
      );

      await createAttendance(
        internshipB.id,
        "2026-03-02",
        "validated",
        adminId,
      );

      // Internship C:
      // 1 validated record = 8 rendered hours.
      // Required hours are null, so remaining hours must be null.
      await createAttendance(
        internshipC.id,
        "2026-04-01",
        "validated",
        adminId,
      );

      // ------------------------------------------------------
      // 5. Administrator can retrieve the report
      // ------------------------------------------------------

      const adminReport = await requestReport(
        "/api/v1/reports/internships",
        adminToken,
      );

      assertEquals(adminReport.response.status, 200);
      assertEquals(adminReport.body.success, true);
      assertExists(adminReport.body.data);

      const reportRows = adminReport.body.data as Array<
        Record<string, unknown>
      >;

      const rowA = reportRows.find(
        (row) => row.internshipId === internshipA.id,
      );

      const rowB = reportRows.find(
        (row) => row.internshipId === internshipB.id,
      );

      const rowC = reportRows.find(
        (row) => row.internshipId === internshipC.id,
      );

      assertExists(rowA);
      assertExists(rowB);
      assertExists(rowC);

      // ------------------------------------------------------
      // 6. Verify report row mapping
      // ------------------------------------------------------

      assertEquals(rowA.status, "pending");
      assertEquals(rowA.requiredHours, 10);
      assertEquals(rowA.renderedHours, 8);
      assertEquals(rowA.remainingHours, 2);

      assertEquals(rowB.status, "active");
      assertEquals(rowB.requiredHours, 12);
      assertEquals(rowB.renderedHours, 16);
      assertEquals(rowB.remainingHours, 0);

      assertEquals(rowC.status, "completed");
      assertEquals(rowC.requiredHours, null);
      assertEquals(rowC.renderedHours, 8);
      assertEquals(rowC.remainingHours, null);

      const studentAReport = rowA.student as Record<string, unknown>;
      const hteAReport = rowA.hte as Record<string, unknown>;

      assertEquals(studentAReport.id, studentA.id);
      assertEquals(studentAReport.studentNumber, studentA.studentNumber);
      assertEquals(studentAReport.program, "BSIT");
      assertExists(studentAReport.name);

      assertEquals(hteAReport.id, hteA.id);
      assertExists(hteAReport.companyName);

      // No evaluation fixture was created in this test.
      // The service should therefore report null evaluation status.
      assertEquals(rowA.evaluationStatus, null);
      assertEquals(rowB.evaluationStatus, null);
      assertEquals(rowC.evaluationStatus, null);

      // ------------------------------------------------------
      // 7. Coordinator can retrieve institutional reports
      // ------------------------------------------------------

      const coordinatorReport = await requestReport(
        "/api/v1/reports/internships",
        coordinatorToken,
      );

      assertEquals(coordinatorReport.response.status, 200);
      assertEquals(coordinatorReport.body.success, true);

      const coordinatorRows = coordinatorReport.body.data as Array<
        Record<string, unknown>
      >;

      assertExists(
        coordinatorRows.find((row) => row.internshipId === internshipA.id),
      );

      // ------------------------------------------------------
      // 7.1. Forwarded client IP handling
      // ------------------------------------------------------

      // Exercise the forwarded-IP extraction path for the
      // internship report endpoint.
      const forwardedIpReport = await authenticatedRequest(
        "/api/v1/reports/internships",
        adminToken,
        {
          headers: {
            "x-forwarded-for": "203.0.113.10, 10.0.0.1",
          },
        },
      );

      assertEquals(forwardedIpReport.status, 200);

      const forwardedIpReportBody = await forwardedIpReport.json();

      assertEquals(forwardedIpReportBody.success, true);

      // Exercise the same path for the summary endpoint.
      const forwardedIpSummary = await authenticatedRequest(
        "/api/v1/reports/internships/summary",
        adminToken,
        {
          headers: {
            "x-forwarded-for": "203.0.113.20, 10.0.0.1",
          },
        },
      );

      assertEquals(forwardedIpSummary.status, 200);

      const forwardedIpSummaryBody = await forwardedIpSummary.json();

      assertEquals(forwardedIpSummaryBody.success, true);

      // ------------------------------------------------------
      // 8. Status filter
      // ------------------------------------------------------

      const pendingReport = await requestReport(
        "/api/v1/reports/internships?status=pending",
        adminToken,
      );

      assertEquals(pendingReport.response.status, 200);

      const pendingRows = pendingReport.body.data as Array<
        Record<string, unknown>
      >;

      assertEquals(
        pendingRows.some((row) => row.internshipId === internshipA.id),
        true,
      );

      assertEquals(
        pendingRows.some((row) => row.internshipId === internshipB.id),
        false,
      );

      assertEquals(
        pendingRows.some((row) => row.internshipId === internshipC.id),
        false,
      );

      // ------------------------------------------------------
      // 9. Program filter
      // ------------------------------------------------------

      const programReport = await requestReport(
        "/api/v1/reports/internships?program=BSCS",
        adminToken,
      );

      assertEquals(programReport.response.status, 200);

      const programRows = programReport.body.data as Array<
        Record<string, unknown>
      >;

      assertEquals(
        programRows.some((row) => row.internshipId === internshipB.id),
        true,
      );

      assertEquals(
        programRows.some((row) => row.internshipId === internshipA.id),
        false,
      );

      assertEquals(
        programRows.some((row) => row.internshipId === internshipC.id),
        false,
      );

      // ------------------------------------------------------
      // 10. HTE filter
      // ------------------------------------------------------

      const hteReport = await requestReport(
        `/api/v1/reports/internships?hte_id=${hteB.id}`,
        adminToken,
      );

      assertEquals(hteReport.response.status, 200);

      const hteRows = hteReport.body.data as Array<Record<string, unknown>>;

      assertEquals(
        hteRows.some((row) => row.internshipId === internshipC.id),
        true,
      );

      assertEquals(
        hteRows.some((row) => row.internshipId === internshipA.id),
        false,
      );

      assertEquals(
        hteRows.some((row) => row.internshipId === internshipB.id),
        false,
      );

      // ------------------------------------------------------
      // 11. Faculty adviser filter
      // ------------------------------------------------------

      const adviserReport = await requestReport(
        `/api/v1/reports/internships?faculty_adviser_id=${facultyAdviserId}`,
        adminToken,
      );

      assertEquals(adviserReport.response.status, 200);

      const adviserRows = adviserReport.body.data as Array<
        Record<string, unknown>
      >;

      assertExists(
        adviserRows.find((row) => row.internshipId === internshipA.id),
      );

      assertExists(
        adviserRows.find((row) => row.internshipId === internshipB.id),
      );

      assertExists(
        adviserRows.find((row) => row.internshipId === internshipC.id),
      );

      // ------------------------------------------------------
      // 12. Combined filters
      // ------------------------------------------------------

      const combinedReport = await requestReport(
        `/api/v1/reports/internships?status=active&program=BSCS&hte_id=${hteA.id}&faculty_adviser_id=${facultyAdviserId}`,
        adminToken,
      );

      assertEquals(combinedReport.response.status, 200);

      const combinedRows = combinedReport.body.data as Array<
        Record<string, unknown>
      >;

      assertEquals(combinedRows.length, 1);
      assertEquals(combinedRows[0].internshipId, internshipB.id);

      // ------------------------------------------------------
      // 13. Query validation
      // ------------------------------------------------------

      const invalidStatus = await requestReport(
        "/api/v1/reports/internships?status=archived",
        adminToken,
      );

      assertEquals(invalidStatus.response.status, 400);

      const invalidHteId = await requestReport(
        "/api/v1/reports/internships?hte_id=not-a-uuid",
        adminToken,
      );

      assertEquals(invalidHteId.response.status, 400);

      const invalidAdviserId = await requestReport(
        "/api/v1/reports/internships?faculty_adviser_id=not-a-uuid",
        adminToken,
      );

      assertEquals(invalidAdviserId.response.status, 400);

      const emptyProgram = await requestReport(
        "/api/v1/reports/internships?program=%20%20",
        adminToken,
      );

      assertEquals(emptyProgram.response.status, 400);

      // ------------------------------------------------------
      // 14. Summary endpoint
      // ------------------------------------------------------

      const summary = await requestReport(
        "/api/v1/reports/internships/summary",
        adminToken,
      );

      assertEquals(summary.response.status, 200);
      assertEquals(summary.body.success, true);

      const summaryData = summary.body.data;

      assertExists(summaryData);

      // Three fixture internships:
      // pending = 1, active = 1, completed = 1.
      assertEquals(summaryData.totalInternships, 3);
      assertEquals(summaryData.pending, 1);
      assertEquals(summaryData.active, 1);
      assertEquals(summaryData.completed, 1);

      // Required hours:
      // 10 + 12 + null = 22.
      assertEquals(summaryData.totalRequiredHours, 22);

      // Validated rendered hours:
      // 8 + 16 + 8 = 32.
      // Pending and rejected attendance are excluded.
      assertEquals(summaryData.totalRenderedHours, 32);

      // Remaining hours:
      // max(10 - 8, 0) + max(12 - 16, 0).
      // Null required hours are excluded from the remaining-hours total.
      assertEquals(summaryData.totalRemainingHours, 2);

      // ------------------------------------------------------
      // 15. Summary filters
      // ------------------------------------------------------

      const filteredSummary = await requestReport(
        "/api/v1/reports/internships/summary?program=BSCS",
        adminToken,
      );

      assertEquals(filteredSummary.response.status, 200);

      const filteredSummaryData = filteredSummary.body.data;

      assertEquals(filteredSummaryData.totalInternships, 1);
      assertEquals(filteredSummaryData.pending, 0);
      assertEquals(filteredSummaryData.active, 1);
      assertEquals(filteredSummaryData.completed, 0);
      assertEquals(filteredSummaryData.totalRequiredHours, 12);
      assertEquals(filteredSummaryData.totalRenderedHours, 16);
      assertEquals(filteredSummaryData.totalRemainingHours, 0);

      // ------------------------------------------------------
      // 16. Empty filtered result
      // ------------------------------------------------------

      const emptyReport = await requestReport(
        "/api/v1/reports/internships?program=NONEXISTENT-PROGRAM",
        adminToken,
      );

      assertEquals(emptyReport.response.status, 200);
      assertEquals(emptyReport.body.success, true);
      assertEquals(emptyReport.body.data.length, 0);

      const emptySummary = await requestReport(
        "/api/v1/reports/internships/summary?program=NONEXISTENT-PROGRAM",
        adminToken,
      );

      assertEquals(emptySummary.response.status, 200);
      assertEquals(emptySummary.body.success, true);
      assertEquals(emptySummary.body.data.totalInternships, 0);
      assertEquals(emptySummary.body.data.pending, 0);
      assertEquals(emptySummary.body.data.active, 0);
      assertEquals(emptySummary.body.data.completed, 0);
      assertEquals(emptySummary.body.data.totalRequiredHours, 0);
      assertEquals(emptySummary.body.data.totalRenderedHours, 0);
      assertEquals(emptySummary.body.data.totalRemainingHours, 0);

      // ------------------------------------------------------
      // 17. Audit trail verification
      // ------------------------------------------------------

      // The reports routes do not supply resourceId to AuditService.log().
      // AuditService therefore persists resource_id as NULL.

      await assertAuditEvent(supabaseAdmin, {
        actorId: adminId,
        action: "GENERATE_REPORT",
        resourceType: "INTERNSHIP_REPORT",
        resourceId: null,
        details: {
          recordCount: reportRows.length,
        },
      });

      const { data: forwardedAuditLogs, error: forwardedAuditError } = await supabaseAdmin
        .from("audit_logs")
        .select("ip_address, resource_type")
        .eq("user_id", adminId)
        .eq("action", "GENERATE_REPORT")
        .in("resource_type", [
          "INTERNSHIP_REPORT",
          "INTERNSHIP_REPORT_SUMMARY",
        ])
        .in("ip_address", ["203.0.113.10", "203.0.113.20"]);

      if (forwardedAuditError) throw forwardedAuditError;

      assertExists(forwardedAuditLogs);

      assertEquals(
        forwardedAuditLogs.some(
          (event) =>
            event.resource_type === "INTERNSHIP_REPORT" &&
            event.ip_address === "203.0.113.10",
        ),
        true,
      );

      assertEquals(
        forwardedAuditLogs.some(
          (event) =>
            event.resource_type === "INTERNSHIP_REPORT_SUMMARY" &&
            event.ip_address === "203.0.113.20",
        ),
        true,
      );

      await assertAuditEvent(supabaseAdmin, {
        actorId: adminId,
        action: "GENERATE_REPORT",
        resourceType: "INTERNSHIP_REPORT_SUMMARY",
        resourceId: null,
        details: {
          totalInternships: 3,
        },
      });
    } finally {
      await cleanupFixtures(fixture);
    }
  },
);

// ============================================================
// Additional FR-10 integration tests
// ============================================================

Deno.test(
  "FR-10 reports integration: filtered summary isolates records and correctly aggregates attendance and remaining hours",
  async () => {
    await setupTestUsers();

    const fixture: CreatedFixture = {
      studentIds: [],
      hteIds: [],
      internshipIds: [],
    };

    try {
      // ------------------------------------------------------
      // 1. Authenticate administrator
      // ------------------------------------------------------

      const adminLogin = await login();

      assertEquals(adminLogin.response.status, 200);
      assertEquals(adminLogin.body.success, true);
      assertExists(adminLogin.body.data?.accessToken);

      const adminToken = adminLogin.body.data.accessToken;
      const adminId = await getTestUserId(TEST_USERS.admin.email);

      const facultyAdviserId = await getTestUserId(
        TEST_USERS.facultyAdviser.email,
      );

      // ------------------------------------------------------
      // 2. Create an isolated reporting fixture
      // ------------------------------------------------------

      // A unique program prevents unrelated database records
      // from affecting the filtered summary.
      const uniqueProgram = `R10-${crypto.randomUUID().slice(0, 8)}`;

      const student = await createReportStudent(uniqueProgram);
      fixture.studentIds.push(student.id);

      const hte = await createReportHte(adminToken);
      fixture.hteIds.push(hte.id);

      const internship = await createReportInternship(
        adminToken,
        student.id,
        hte.id,
        facultyAdviserId,
        5,
      );

      fixture.internshipIds.push(internship.id);

      await setInternshipStatus(internship.id, "active");

      // ------------------------------------------------------
      // 3. Create attendance records
      // ------------------------------------------------------

      // Validated: 8 rendered hours.
      await createAttendance(internship.id, "2026-05-01", "validated", adminId);

      // Pending: must not contribute to rendered hours.
      await createAttendance(internship.id, "2026-05-02", "pending", adminId);

      // Rejected: must not contribute to rendered hours.
      await createAttendance(internship.id, "2026-05-03", "rejected", adminId);

      // ------------------------------------------------------
      // 4. Verify filtered report
      // ------------------------------------------------------

      const report = await requestReport(
        `/api/v1/reports/internships?program=${encodeURIComponent(uniqueProgram)}`,
        adminToken,
      );

      assertEquals(report.response.status, 200);
      assertEquals(report.body.success, true);
      assertExists(report.body.data);

      const rows = report.body.data as Array<Record<string, unknown>>;

      // Only the isolated fixture should be returned.
      assertEquals(rows.length, 1);
      assertEquals(rows[0].internshipId, internship.id);
      assertEquals(rows[0].status, "active");
      assertEquals(rows[0].requiredHours, 5);
      assertEquals(rows[0].renderedHours, 8);

      // Rendered hours exceed required hours.
      // Remaining hours must not become negative.
      assertEquals(rows[0].remainingHours, 0);

      // ------------------------------------------------------
      // 5. Verify filtered summary
      // ------------------------------------------------------

      const summary = await requestReport(
        `/api/v1/reports/internships/summary?program=${encodeURIComponent(uniqueProgram)}`,
        adminToken,
      );

      assertEquals(summary.response.status, 200);
      assertEquals(summary.body.success, true);
      assertExists(summary.body.data);

      const summaryData = summary.body.data;

      // Only the isolated internship contributes.
      assertEquals(summaryData.totalInternships, 1);

      assertEquals(summaryData.pending, 0);
      assertEquals(summaryData.active, 1);
      assertEquals(summaryData.completed, 0);

      // Required hours = 5.
      assertEquals(summaryData.totalRequiredHours, 5);

      // Only the validated attendance contributes = 8.
      assertEquals(summaryData.totalRenderedHours, 8);

      // max(5 - 8, 0) = 0.
      assertEquals(summaryData.totalRemainingHours, 0);

      // ------------------------------------------------------
      // 6. Verify status-filtered summary
      // ------------------------------------------------------

      const pendingSummary = await requestReport(
        `/api/v1/reports/internships/summary?program=${
          encodeURIComponent(
            uniqueProgram,
          )
        }&status=pending`,
        adminToken,
      );

      assertEquals(pendingSummary.response.status, 200);
      assertEquals(pendingSummary.body.success, true);

      assertEquals(pendingSummary.body.data.totalInternships, 0);

      assertEquals(pendingSummary.body.data.pending, 0);
      assertEquals(pendingSummary.body.data.active, 0);
      assertEquals(pendingSummary.body.data.completed, 0);

      assertEquals(pendingSummary.body.data.totalRequiredHours, 0);
      assertEquals(pendingSummary.body.data.totalRenderedHours, 0);
      assertEquals(pendingSummary.body.data.totalRemainingHours, 0);
    } finally {
      await cleanupFixtures(fixture);
    }
  },
);
