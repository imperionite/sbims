import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL;
const EMAIL = __ENV.K6_EMAIL;
const PASSWORD = __ENV.K6_PASSWORD;

// ============================================================
// Pilot configuration
// ============================================================

// Desired workflow arrival rate.
// Example:
// 0.5 workflow/s = 30 workflows/minute
const WORKFLOW_RATE = Number(__ENV.K6_RATE || 0.5);

// k6 arrival-rate executors require the rate to be expressed
// as iterations per selected timeUnit.
const WORKFLOW_RATE_PER_MINUTE = Math.round(WORKFLOW_RATE * 60);

const TEST_DURATION = __ENV.K6_DURATION || "3m";
const THINK_TIME = Number(__ENV.K6_THINK_TIME || 2);

// ============================================================
// Custom workflow metrics
// ============================================================

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

      // 0.5 workflow/s = 30 workflow iterations/minute.
      //
      // Workflow arrival rate is the experimental workload
      // variable. VUs are only execution resources.
      rate: WORKFLOW_RATE_PER_MINUTE,
      timeUnit: "1m",

      // Pilot measurement duration.
      duration: TEST_DURATION,

      // k6 execution resources.
      // These are not the experimental workload variable.
      preAllocatedVUs: 5,
      maxVUs: 20,

      gracefulStop: "0s",
    },
  },

  // No performance thresholds are applied.
  // This is a characterization pilot.
};

// ============================================================
// Authentication Workflow
//
// 1. Login
// 2. Think
// 3. Retrieve current user
// 4. Think
// 5. Retrieve user role
// 6. Think
// 7. Administrator authorization check
// 8. Think
// 9. Refresh token
//
// One workflow iteration performs one login.
// ============================================================

export default function () {
  const workflowStart = Date.now();

  let workflowSuccessful = true;

  // ============================================================
  // 1. LOGIN
  // ============================================================

  const loginResponse = http.post(
    `${BASE_URL}/api/v1/auth/login`,
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
    "login completed": (response) => response.status === 200,
  });

  if (!loginOK) {
    workflowFailed.add(1);
    workflowDuration.add(Date.now() - workflowStart);
    return;
  }

  const loginBody = loginResponse.json();

  const accessToken =
    loginBody.data?.access_token ??
    loginBody.access_token ??
    loginBody.session?.access_token;

  const refreshToken =
    loginBody.data?.refresh_token ??
    loginBody.refresh_token ??
    loginBody.session?.refresh_token;

  if (!accessToken) {
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

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };

  // ============================================================
  // 2. GET CURRENT USER
  // ============================================================

  const meResponse = http.get(`${BASE_URL}/api/v1/auth/me`, {
    ...authHeaders,
    tags: {
      endpoint: "current-user",
    },
  });

  const meOK = check(meResponse, {
    "current user retrieved": (response) => response.status === 200,
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

  const roleResponse = http.get(`${BASE_URL}/api/v1/auth/role`, {
    ...authHeaders,
    tags: {
      endpoint: "user-role",
    },
  });

  const roleOK = check(roleResponse, {
    "user role retrieved": (response) => response.status === 200,
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

  const adminCheckResponse = http.get(`${BASE_URL}/api/v1/auth/admin-check`, {
    ...authHeaders,
    tags: {
      endpoint: "admin-check",
    },
  });

  const adminCheckOK = check(adminCheckResponse, {
    "administrator access granted": (response) => response.status === 200,
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

  if (!refreshToken) {
    workflowSuccessful = false;
  } else {
    const refreshResponse = http.post(
      `${BASE_URL}/api/v1/auth/refresh`,
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
      "token refresh completed": (response) => response.status === 200,
    });

    if (!refreshOK) {
      workflowSuccessful = false;
    }
  }

  // ============================================================
  // WORKFLOW RESULT
  // ============================================================

  workflowDuration.add(Date.now() - workflowStart);

  if (workflowSuccessful) {
    workflowCompleted.add(1);
  } else {
    workflowFailed.add(1);
  }
}
