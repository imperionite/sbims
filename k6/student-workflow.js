import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

// ============================================================
// 1. Configuration
// ============================================================

function readIntegerEnv(name, fallback) {
  const raw = __ENV[name];

  if (raw === undefined || raw === "") {
    return fallback;
  }

  if (!/^-?\d+$/.test(raw)) {
    throw new Error(`${name} must be a valid integer.`);
  }

  const value = Number(raw);

  if (!Number.isSafeInteger(value)) {
    throw new Error(`${name} must be a safe integer.`);
  }

  return value;
}

function readNumberEnv(name, fallback) {
  const raw = __ENV[name];

  if (raw === undefined || raw === "") {
    return fallback;
  }

  const value = Number(raw);

  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a valid number.`);
  }

  return value;
}

const BASE_URL = (__ENV.BASE_URL || "").replace(/\/+$/, "");
const API_BASE = `${BASE_URL}/api/v1`;

const EMAIL = __ENV.K6_EMAIL || "";
const PASSWORD = __ENV.K6_PASSWORD || "";

const VUS = readIntegerEnv("K6_VUS", 25);
const DURATION = __ENV.K6_DURATION || "4m";
const THINK_TIME = readNumberEnv("K6_THINK_TIME", 1);
const TRIAL = readIntegerEnv("K6_TRIAL", 3);
const SCENARIO_ID = __ENV.K6_SCENARIO || "student-workflow";

const RESULTS_FILE =
  __ENV.RESULTS_FILE ||
  `k6/results/student_vus_${VUS}_trial_${TRIAL}_summary.json`;

const EXPERIMENT_ID = __ENV.EXPERIMENT_ID || null;
const SCRIPT_VERSION = "1.4";

// script initialization timestamp
// process start time or the first request timestamp.
const SCRIPT_INITIALIZED_AT_UTC = new Date().toISOString();

// Validate configuration before the test starts.
if (!/^https?:\/\/[^/]+$/i.test(BASE_URL)) {
  throw new Error(
    "BASE_URL must be an HTTP(S) origin, such as https://api.sbims.me.",
  );
}

if (!EMAIL || !PASSWORD) {
  throw new Error("K6_EMAIL and K6_PASSWORD must be set.");
}

if (!Number.isInteger(VUS) || VUS < 1) {
  throw new Error("K6_VUS must be a positive integer.");
}

if (!Number.isInteger(TRIAL) || TRIAL < 0) {
  throw new Error("K6_TRIAL must be a non-negative integer.");
}

if (!Number.isFinite(THINK_TIME) || THINK_TIME < 0) {
  throw new Error("K6_THINK_TIME must be a non-negative number.");
}

if (!DURATION.trim()) {
  throw new Error("K6_DURATION must not be empty.");
}

// ============================================================
// 2. k6 execution options
// ============================================================

export const options = {
  scenarios: {
    student_workflow: {
      executor: "constant-vus",
      vus: VUS,
      duration: DURATION,
      gracefulStop: "30s",
    },
  },

  summaryTrendStats: [
    "avg",
    "min",
    "med",
    "max",
    "p(90)",
    "p(95)",
    "p(99)",
  ],

  userAgent: "SBIMS-k6-characterization/1.0",
  noConnectionReuse: false,
  discardResponseBodies: false,

  setupTimeout: "30s",
  teardownTimeout: "30s",

  tags: {
    system: "SBIMS",
    workflow: SCENARIO_ID,
    workload_vus: String(VUS),
    trial: String(TRIAL),
    study_type: "characterization",
  },
};

// ============================================================
// 3. Custom metrics
// ============================================================

// One successful workflow means all three authenticated
// endpoints passed their expected response checks.
const workflowSuccess = new Rate("workflow_success_rate");

// Counts workflows that attempted all three authenticated reads,
// regardless of whether the requests succeeded.
const workflowCompleted = new Counter("workflow_completed");

// Counts workflows with at least one unsuccessful endpoint.
const workflowFailed = new Counter("workflow_failed");

// Measures the three authenticated reads plus the think time
// between them. The final sleep is excluded.
const workflowDuration = new Trend("workflow_duration", true);

// ============================================================
// 4. Response helpers
// ============================================================

function validJson(response) {
  try {
    return response.json();
  } catch (_) {
    return null;
  }
}

function isApiSuccess(response, body) {
  return (
    response.status >= 200 &&
    response.status < 300 &&
    body?.success === true
  );
}

function getAuthenticated(path, endpointName, token) {
  return http.get(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    tags: {
      endpoint: endpointName,
      operation: "read",
    },
    timeout: "30s",
  });
}

// ============================================================
// 5. Global setup: one login per test execution
// ============================================================

export function setup() {
  const response = http.post(
    `${API_BASE}/auth/login`,
    JSON.stringify({
      email: EMAIL,
      password: PASSWORD,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      tags: {
        endpoint: "auth-login",
        operation: "setup-login",
      },
      timeout: "30s",
    },
  );

  const body = validJson(response);

  const loginPassed = check(response, {
    "setup login returns 200": (r) => r.status === 200,

    "setup login response indicates success": () =>
      body?.success === true,

    "setup login response contains access token": () =>
      typeof body?.data?.accessToken === "string" &&
      body.data.accessToken.length > 0,
  });

  if (
    !loginPassed ||
    typeof body?.data?.accessToken !== "string" ||
    body.data.accessToken.length === 0
  ) {
    throw new Error(
      `Setup login failed with HTTP status ${response.status}. ` +
        "Check the credentials, API origin, and login response.",
    );
  }

  // k6 distributes setup data to VUs. The token is not written
  // to the summary file or explicitly persisted by this script.
  return {
    accessToken: body.data.accessToken,
  };
}

// ============================================================
// 6. Student workflow
// ============================================================

export default function (data) {
  const token = data?.accessToken;

  // Defensive handling. Normally, a failed setup login aborts
  // the test before this function runs.
  if (!token) {
    workflowFailed.add(1);
    workflowSuccess.add(false, {
      workflow: SCENARIO_ID,
    });

    return;
  }

  const started = Date.now();
  let allPassed = true;

  // ----------------------------------------------------------
  // Step 1: Current user
  // ----------------------------------------------------------

  const meResponse = getAuthenticated(
    "/auth/me",
    "auth-me",
    token,
  );

  const meBody = validJson(meResponse);

  const mePassed = check(meResponse, {
    "current-user endpoint returns 200": (r) =>
      r.status === 200,

    "current-user response indicates success": () =>
      meBody?.success === true,
  });

  allPassed =
    allPassed &&
    mePassed &&
    isApiSuccess(meResponse, meBody);

  if (THINK_TIME > 0) {
    sleep(THINK_TIME);
  }

  // ----------------------------------------------------------
  // Step 2: Student profile
  // ----------------------------------------------------------

  const studentResponse = getAuthenticated(
    "/students/me",
    "student-profile-me",
    token,
  );

  const studentBody = validJson(studentResponse);

  const studentPassed = check(studentResponse, {
    "student profile endpoint returns 200": (r) =>
      r.status === 200,

    "student profile response indicates success": () =>
      studentBody?.success === true,
  });

  allPassed =
    allPassed &&
    studentPassed &&
    isApiSuccess(studentResponse, studentBody);

  if (THINK_TIME > 0) {
    sleep(THINK_TIME);
  }

  // ----------------------------------------------------------
  // Step 3: Student attendance
  // ----------------------------------------------------------

  const attendanceResponse = getAuthenticated(
    "/attendance/me",
    "attendance-me",
    token,
  );

  const attendanceBody = validJson(attendanceResponse);

  const attendancePassed = check(attendanceResponse, {
    "student attendance endpoint returns 200": (r) =>
      r.status === 200,

    "student attendance response indicates success": () =>
      attendanceBody?.success === true,
  });

  allPassed =
    allPassed &&
    attendancePassed &&
    isApiSuccess(attendanceResponse, attendanceBody);

  // Record duration after all three requests have been attempted.
  // This includes the think times between requests.
  workflowDuration.add(Date.now() - started, {
    workflow: SCENARIO_ID,
  });

  // Every workflow reaching this point attempted all three reads.
  workflowCompleted.add(1);

  if (allPassed) {
    workflowSuccess.add(true, {
      workflow: SCENARIO_ID,
    });
  } else {
    workflowFailed.add(1);

    workflowSuccess.add(false, {
      workflow: SCENARIO_ID,
    });
  }

  // Think time before the next iteration; excluded from workflowDuration.
  if (THINK_TIME > 0) {
    sleep(THINK_TIME);
  }
}

// ============================================================
// 7. Summary and experiment metadata
// ============================================================

export function handleSummary(data) {
  const summaryGeneratedAtUtc = new Date().toISOString();

  const metadata = {
    experiment_id: EXPERIMENT_ID,
    scenario_id: SCENARIO_ID,
    trial: TRIAL,

    configured_vus: VUS,
    workload_model: "constant-vus",
    configured_duration: DURATION,
    think_time_seconds: THINK_TIME,

    target_origin: BASE_URL,
    api_base_path: "/api/v1",
    effective_api_base: API_BASE,

    k6_script_initialized_at_utc:
      SCRIPT_INITIALIZED_AT_UTC,

    wrapper_execution_started_at_utc:
      __ENV.SBIMS_WRAPPER_STARTED_AT_UTC || null,

    k6_summary_generated_at_utc:
      summaryGeneratedAtUtc,

    k6_measured_duration_ms:
      data?.state?.testRunDurationMs ?? null,

    k6_version: __ENV.K6_VERSION || null,
    git_commit: __ENV.GIT_COMMIT || null,
    runner: __ENV.CI_RUNNER || null,

    script: "k6/student-workflow.js",
    script_version: SCRIPT_VERSION,
    study_type: "characterization",

    token_persisted: false,

    authentication_model:
      "One login in setup() per test execution; setup data supplies " +
      "the same student access token to all VUs. No per-VU or " +
      "per-iteration login is performed.",

    metrics_scope:
      "workflow_duration measures the three authenticated reads " +
      "and think time between them, excluding the final sleep. " +
      "Built-in http_req_* metrics include the setup login and " +
      "authenticated reads. workflow_completed counts workflows " +
      "that attempted all three authenticated reads; " +
      "workflow_failed counts those with at least one unsuccessful " +
      "endpoint; workflow_success_rate records the proportion " +
      "of workflows in which all three reads passed.",

    notes:
      "Run warm-up separately and exclude it from formal trial " +
      "analysis. The wrapper records execution start/end timestamps " +
      "and elapsed time. k6 measured duration is a separate " +
      "measurement. The script initialization timestamp is not " +
      "the wrapper process start time. Provider-side Deno Deploy " +
      "and Supabase metrics and client environment samples must " +
      "be collected separately.",

  };

  const output = {
    ...data,
    metadata,
  };

  return {
    [RESULTS_FILE]: JSON.stringify(output, null, 2),

    stdout:
      `\nSBIMS k6 run complete. Summary: ${RESULTS_FILE}\n` +
      `Scenario=${SCENARIO_ID}, ` +
      `VUs=${VUS}, ` +
      `duration=${DURATION}, ` +
      `trial=${TRIAL}; ` +
      "single setup login executed.\n",
  };
}