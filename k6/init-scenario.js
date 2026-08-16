import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";

// ============================================================
// Configuration
// ============================================================

const BASE_URL = __ENV.BASE_URL;

if (!BASE_URL) {
  throw new Error("BASE_URL environment variable is required.");
}

const EMAIL = __ENV.K6_EMAIL;

const PASSWORD = __ENV.K6_PASSWORD;

if (!EMAIL) {
  throw new Error("K6_EMAIL environment variable is required.");
}

if (!PASSWORD) {
  throw new Error("K6_PASSWORD environment variable is required.");
}

const WORKFLOW_RATE = Number(__ENV.K6_RATE || 0.5);
const TEST_DURATION = __ENV.K6_DURATION || "1m";
const THINK_TIME = Number(__ENV.K6_THINK_TIME || 2);

if (!Number.isFinite(WORKFLOW_RATE) || WORKFLOW_RATE <= 0) {
  throw new Error("K6_RATE must be greater than 0.");
}

if (!Number.isFinite(THINK_TIME) || THINK_TIME < 0) {
  throw new Error("K6_THINK_TIME must be zero or greater.");
}

const WORKFLOW_RATE_PER_MINUTE = Math.round(WORKFLOW_RATE * 60);

if (WORKFLOW_RATE_PER_MINUTE < 1) {
  throw new Error(
    "K6_RATE is too small. It must produce at least 1 workflow per minute.",
  );
}

const API_BASE_URL = BASE_URL.replace(/\/+$/, "");

// ============================================================
// Custom metrics
// ============================================================
//
// workflow_completed:
//   Complete authentication workflows.
//
// workflow_failed:
//   Workflows that failed at any stage.
//
// workflow_duration:
//   Complete workflow duration, including think time.
//

const workflowCompleted = new Counter("workflow_completed");
const workflowFailed = new Counter("workflow_failed");
const workflowDuration = new Trend("workflow_duration");

// ============================================================
// k6 configuration
// ============================================================

export const options = {
  scenarios: {
    authentication_workflow: {
      executor: "constant-arrival-rate",

      // Experimental workload variable.
      //
      // Example:
      //   K6_RATE=0.5
      //
      // means approximately 0.5 workflow iterations/second,
      // or 30 complete workflow arrivals/minute.
      rate: WORKFLOW_RATE_PER_MINUTE,

      timeUnit: "1m",

      // Measurement duration.
      duration: TEST_DURATION,

      // VUs are execution resources required to sustain
      // the selected workflow arrival rate.
      preAllocatedVUs: 5,
      maxVUs: 20,

      gracefulStop: "30s",
    },
  },

  // No thresholds during characterization.
  //
  // Thresholds should be introduced after baseline results
  // have been established for both deployment targets.
};

// ============================================================
// Authentication Workflow
//
// One iteration represents one complete user journey:
//
// 1. Login
// 2. Think time
// 3. Retrieve current user
// 4. Think time
// 5. Retrieve user role
// 6. Think time
// 7. Administrator authorization check
// 8. Think time
// 9. Refresh authentication token
//
// The workflow is considered successful only when all
// required stages complete successfully.
//
// NOTE:
// This workflow accesses authentication/profile infrastructure
// and therefore is NOT DB-less.
// ============================================================

export default function () {
  const workflowStart = Date.now();

  let workflowSuccessful = true;

  // ============================================================
  // 1. LOGIN
  // ============================================================

  const loginResponse = http.post(
    `${API_BASE_URL}/api/v1/auth/login`,
    JSON.stringify({
      email: EMAIL,
      password: PASSWORD,
    }),
    {
      headers: {
        "Content-Type": "application/json",
      },
      tags: {
        endpoint: "login",
      },
    },
  );

  const loginOK = check(loginResponse, {
    "login returned 200": (response) => response.status === 200,

    "login response is JSON": (response) =>
      response.headers["Content-Type"]?.includes("application/json") ?? false,
  });

  if (!loginOK) {
    workflowFailed.add(1);
    workflowDuration.add(Date.now() - workflowStart);
    return;
  }

  // ============================================================
  // Extract authentication tokens
  // ============================================================

  let loginBody;

  try {
    loginBody = loginResponse.json();
  } catch {
    workflowFailed.add(1);
    workflowDuration.add(Date.now() - workflowStart);
    return;
  }

  const accessToken =
    loginBody.data?.access_token ??
    loginBody.access_token ??
    loginBody.session?.access_token;

  const refreshToken =
    loginBody.data?.refresh_token ??
    loginBody.refresh_token ??
    loginBody.session?.refresh_token;

  const tokenOK = check(loginResponse, {
    "access token returned": () => Boolean(accessToken),
    "refresh token returned": () => Boolean(refreshToken),
  });

  if (!tokenOK) {
    workflowFailed.add(1);
    workflowDuration.add(Date.now() - workflowStart);
    return;
  }

  // ============================================================
  // THINK TIME
  // ============================================================

  sleep(THINK_TIME);

  // ============================================================
  // AUTHENTICATED REQUEST HEADERS
  // ============================================================

  const authParams = {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };

  // ============================================================
  // 2. GET CURRENT USER
  // ============================================================

  const meResponse = http.get(`${API_BASE_URL}/api/v1/auth/me`, {
    ...authParams,
    tags: {
      endpoint: "current-user",
    },
  });

  const meOK = check(meResponse, {
    "current user returned 200": (response) => response.status === 200,

    "current user response is JSON": (response) =>
      response.headers["Content-Type"]?.includes("application/json") ?? false,
  });

  if (!meOK) {
    workflowSuccessful = false;
  }

  // ============================================================
  // THINK TIME
  // ============================================================

  sleep(THINK_TIME);

  // ============================================================
  // 3. GET USER ROLE
  // ============================================================

  const roleResponse = http.get(`${API_BASE_URL}/api/v1/auth/role`, {
    ...authParams,
    tags: {
      endpoint: "user-role",
    },
  });

  const roleOK = check(roleResponse, {
    "user role returned 200": (response) => response.status === 200,

    "user role response is JSON": (response) =>
      response.headers["Content-Type"]?.includes("application/json") ?? false,
  });

  if (!roleOK) {
    workflowSuccessful = false;
  }

  // ============================================================
  // THINK TIME
  // ============================================================

  sleep(THINK_TIME);

  // ============================================================
  // 4. ADMINISTRATOR AUTHORIZATION CHECK
  // ============================================================

  const adminCheckResponse = http.get(
    `${API_BASE_URL}/api/v1/auth/admin-check`,
    {
      ...authParams,
      tags: {
        endpoint: "admin-check",
      },
    },
  );

  const adminCheckOK = check(adminCheckResponse, {
    "administrator access returned 200": (response) => response.status === 200,

    "administrator response is JSON": (response) =>
      response.headers["Content-Type"]?.includes("application/json") ?? false,
  });

  if (!adminCheckOK) {
    workflowSuccessful = false;
  }

  // ============================================================
  // THINK TIME
  // ============================================================

  sleep(THINK_TIME);

  // ============================================================
  // 5. REFRESH TOKEN
  // ============================================================

  const refreshResponse = http.post(
    `${API_BASE_URL}/api/v1/auth/refresh`,
    JSON.stringify({
      refresh_token: refreshToken,
    }),
    {
      headers: {
        "Content-Type": "application/json",
      },
      tags: {
        endpoint: "refresh",
      },
    },
  );

  const refreshOK = check(refreshResponse, {
    "token refresh returned 200": (response) => response.status === 200,

    "refresh response is JSON": (response) =>
      response.headers["Content-Type"]?.includes("application/json") ?? false,
  });

  if (!refreshOK) {
    workflowSuccessful = false;
  }

  // ============================================================
  // WORKFLOW RESULT
  // ============================================================

  const duration = Date.now() - workflowStart;

  workflowDuration.add(duration);

  if (workflowSuccessful) {
    workflowCompleted.add(1);
  } else {
    workflowFailed.add(1);
  }
}
