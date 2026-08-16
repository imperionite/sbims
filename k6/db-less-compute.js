import http from "k6/http";
import { check } from "k6";
import { Counter, Trend } from "k6/metrics";

// ============================================================
// Configuration
// ============================================================

const BASE_URL = __ENV.BASE_URL;

if (!BASE_URL) {
  throw new Error("BASE_URL environment variable is required.");
}

const WORK = Number(__ENV.K6_WORK || 1000);
const VUS = Number(__ENV.K6_VUS || 1);
const DURATION = __ENV.K6_DURATION || "1m";

if (!Number.isInteger(WORK) || WORK < 1) {
  throw new Error("K6_WORK must be a positive integer.");
}

if (!Number.isInteger(VUS) || VUS < 1) {
  throw new Error("K6_VUS must be a positive integer.");
}

// Remove trailing slash so that BASE_URL/api/... is consistent.
const API_BASE_URL = BASE_URL.replace(/\/+$/, "");

// ============================================================
// Custom metrics
// ============================================================

const computeCompleted = new Counter("compute_completed");
const computeDuration = new Trend("compute_duration");

// ============================================================
// k6 configuration
// ============================================================

export const options = {
  scenarios: {
    compute_load: {
      executor: "constant-vus",

      // Number of concurrent virtual users.
      vus: VUS,

      // Measurement duration.
      duration: DURATION,

      // Allow active iterations to finish.
      gracefulStop: "30s",
    },
  },

  // Do not define performance thresholds yet.
  //
  // This stage is characterization.
  // Baseline measurements will be used to establish
  // appropriate thresholds later.
};

// ============================================================
// DB-less Compute Workload
//
// Each iteration performs exactly ONE HTTP request:
//
// GET /api/v1/performance/compute?work=<WORK>
//
// Example:
//
// GET /api/v1/performance/compute?work=1000
//
// The endpoint intentionally does not access:
//
// - Supabase
// - PostgreSQL
// - authentication
// - Redis
// - external APIs
// - persistent application state
//
// Therefore, the workload primarily measures:
//
// HTTP request handling
// + routing
// + middleware
// + application execution
// + runtime execution
// + response serialization
// + network/request overhead
//
// This makes it suitable for comparing deployment runtimes.
// ============================================================

export default function () {
  const start = Date.now();

  const response = http.get(
    `${API_BASE_URL}/api/v1/performance/compute?work=${WORK}`,
    {
      tags: {
        endpoint: "performance-compute",
      },
    },
  );

  const success = check(response, {
    "status is 200": (response) => response.status === 200,

    "response is JSON": (response) =>
      response.headers["Content-Type"]?.includes("application/json") ?? false,

    "success is true": (response) => {
      try {
        return response.json("success") === true;
      } catch {
        return false;
      }
    },

    "work matches requested value": (response) => {
      try {
        return Number(response.json("data.work")) === WORK;
      } catch {
        return false;
      }
    },
  });

  const duration = Date.now() - start;

  computeDuration.add(duration);

  if (success) {
    computeCompleted.add(1);
  }
}
