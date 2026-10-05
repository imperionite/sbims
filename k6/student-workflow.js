import http from "k6/http";
import { check, sleep, group } from "k6";
import { Counter, Trend } from "k6/metrics";

// ============================================================
// Custom Metrics
// ============================================================

const workflowCompleted = new Counter("workflow_completed");
const workflowFailed = new Counter("workflow_failed");
const workflowDuration = new Trend("workflow_duration", true);

// ============================================================
// Runtime Parameters
// ============================================================

const BASE_URL = __ENV.BASE_URL || "https://api.sbims.me/api/v1";

const TARGET_VUS = Number.parseInt(__ENV.TEST_VUS || "5", 10);

const TEST_EMAIL = __ENV.STUDENT_EMAIL || "studentsbims6@grr.la";

const TEST_PASSWORD = __ENV.STUDENT_PASSWORD || "Dev2026!";

// Keep this constant across all experimental runs.
// Default = 2 seconds.
const THINK_TIME = Number.parseFloat(__ENV.THINK_TIME || "2");

// ============================================================
// Validation
// ============================================================

if (!Number.isInteger(TARGET_VUS) || TARGET_VUS < 1) {
  throw new Error(
    `TEST_VUS must be a positive integer. Received: ${TARGET_VUS}`,
  );
}

if (!Number.isFinite(THINK_TIME) || THINK_TIME < 0) {
  throw new Error(`THINK_TIME must be >= 0. Received: ${THINK_TIME}`);
}

// ============================================================
// K6 Configuration
// ============================================================

export const options = {
  // ----------------------------------------------------------
  // 4-minute workload
  //
  // 0 VUs
  //   ↓ 30s ramp-up
  // TARGET_VUS
  //   ↓ 3m steady state
  // TARGET_VUS
  //   ↓ 30s ramp-down
  // 0 VUs
  // ----------------------------------------------------------

  stages: [
    {
      duration: "30s",
      target: TARGET_VUS,
    },
    {
      duration: "3m",
      target: TARGET_VUS,
    },
    {
      duration: "30s",
      target: 0,
    },
  ],

  gracefulRampDown: "30s",

  gracefulStop: "30s",

  thresholds: {
    // Less than 1% failed HTTP requests.
    http_req_failed: ["rate<0.01"],

    // Recommended if 5 seconds is your actual
    // acceptance criterion.
    http_req_duration: ["p(95)<5000"],
  },
};

// ============================================================
// SETUP
// ============================================================

export function setup() {
  const loginPayload = JSON.stringify({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  const headers = {
    "Content-Type": "application/json",
  };

  console.log(
    `[SETUP] Authenticating as ${TEST_EMAIL} ` +
      `against ${BASE_URL}/auth/login...`,
  );

  const loginRes = http.post(`${BASE_URL}/auth/login`, loginPayload, {
    headers,
    tags: {
      endpoint: "auth_login",
    },
  });

  if (loginRes.status !== 200) {
    throw new Error(
      `[SETUP FAILED] Login failed with HTTP ` +
        `${loginRes.status}: ${loginRes.body}`,
    );
  }

  const token = loginRes.json("data.accessToken");

  if (!token) {
    throw new Error("[SETUP FAILED] No accessToken found in login response.");
  }

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // ----------------------------------------------------------
  // Find active internship
  // ----------------------------------------------------------

  console.log(
    `[SETUP] Checking active internship via ` + `${BASE_URL}/internships/me...`,
  );

  const internRes = http.get(`${BASE_URL}/internships/me`, {
    headers: authHeaders,
    tags: {
      endpoint: "internships_me_setup",
    },
  });

  let internshipId = null;

  if (internRes.status === 200 && internRes.json("data.id")) {
    internshipId = internRes.json("data.id");

    console.log(`[SETUP] Found active internship UUID: ${internshipId}`);
  } else {
    // --------------------------------------------------------
    // Attendance fallback
    // --------------------------------------------------------

    console.log(
      `[SETUP] /internships/me returned ` +
        `HTTP ${internRes.status}. ` +
        `Checking attendance fallback...`,
    );

    const attRes = http.get(`${BASE_URL}/attendance/me`, {
      headers: authHeaders,
      tags: {
        endpoint: "attendance_me_setup",
      },
    });

    if (attRes.status === 200) {
      const records = attRes.json("data");

      if (Array.isArray(records)) {
        const recordWithInternship = records.find(
          (record) => record && record.internship_id,
        );

        if (recordWithInternship) {
          internshipId = recordWithInternship.internship_id;

          console.log(
            `[SETUP] Found internship UUID from ` +
              `attendance: ${internshipId}`,
          );
        }
      }
    }
  }

  if (!internshipId) {
    throw new Error(
      `[SETUP FAILED] Student ${TEST_EMAIL} ` +
        `has no usable internship assignment.`,
    );
  }

  console.log("[SETUP] Setup completed successfully.");

  return {
    authToken: token,
    internshipId,
  };
}

// ============================================================
// VU WORKLOAD
// ============================================================

export default function (data) {
  const workflowStart = Date.now();

  let workflowOk = true;

  const authHeaders = {
    Authorization: `Bearer ${data.authToken}`,
    "Content-Type": "application/json",
  };

  group("Student Representative Internship Workflow", function () {
    // ======================================================
    // Step 1 — Profile
    // ======================================================

    const meRes = http.get(`${BASE_URL}/auth/me`, {
      headers: authHeaders,
      tags: {
        endpoint: "auth_me",
      },
    });

    const mePassed = check(meRes, {
      "Step 1 auth/me - Status 200": (r) => r.status === 200,
    });

    if (!mePassed) {
      workflowOk = false;
    }

    sleep(THINK_TIME);

    // ======================================================
    // Step 2 — Internship
    // ======================================================

    const internRes = http.get(`${BASE_URL}/internships/me`, {
      headers: authHeaders,
      tags: {
        endpoint: "internships_me",
      },
    });

    const internPassed = check(internRes, {
      "Step 2 internships/me - Status 200/404": (r) =>
        r.status === 200 || r.status === 404,
    });

    if (!internPassed) {
      workflowOk = false;
    }

    sleep(THINK_TIME);

    // ======================================================
    // Step 3 — Attendance
    // ======================================================

    const attRes = http.get(`${BASE_URL}/attendance/me`, {
      headers: authHeaders,
      tags: {
        endpoint: "attendance_me",
      },
    });

    const attPassed = check(attRes, {
      "Step 3 attendance/me - Status 200": (r) => r.status === 200,
    });

    if (!attPassed) {
      workflowOk = false;
    }

    sleep(THINK_TIME);

    // ======================================================
    // Step 4 — Rendered Hours
    // ======================================================

    const hoursRes = http.get(
      `${BASE_URL}/attendance/internship/` +
        `${data.internshipId}/rendered-hours`,
      {
        headers: authHeaders,
        tags: {
          endpoint: "rendered_hours",
        },
      },
    );

    const hoursPassed = check(hoursRes, {
      "Step 4 rendered-hours - Status 200": (r) => r.status === 200,
    });

    if (!hoursPassed) {
      workflowOk = false;
    }

    sleep(THINK_TIME);
  });

  // ==========================================================
  // Custom Workflow Metrics
  // ==========================================================

  const duration = Date.now() - workflowStart;

  workflowDuration.add(duration);

  if (workflowOk) {
    workflowCompleted.add(1);
  } else {
    workflowFailed.add(1);
  }
}
