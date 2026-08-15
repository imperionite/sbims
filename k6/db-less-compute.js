import http from "k6/http";
import { check } from "k6";
import { Counter, Trend } from "k6/metrics";

// ============================================================
// Configuration
// ============================================================

const BASE_URL = __ENV.K6_BASE_URL || "https://sbims-dev.imperionite.deno.net";

const WORK = Number(__ENV.K6_WORK || 1000);

const RATE = Number(__ENV.K6_RATE || 0.5);
const RATE_PER_MINUTE = Math.round(RATE * 60);

const DURATION = __ENV.K6_DURATION || "1m";

// ============================================================
// Custom metrics
// ============================================================

const computeCompleted = new Counter("compute_completed");
const computeFailed = new Counter("compute_failed");
const computeDuration = new Trend("compute_duration");

// ============================================================
// k6 configuration
// ============================================================

export const options = {
  scenarios: {
    db_less_compute: {
      executor: "constant-arrival-rate",

      // Experimental workload:
      // default = 0.5 requests/second
      rate: RATE_PER_MINUTE,
      timeUnit: "1m",

      duration: DURATION,

      // Execution resources.
      // These are not the workload variable.
      preAllocatedVUs: 5,
      maxVUs: 20,

      gracefulStop: "0s",
    },
  },
};

// ============================================================
// DB-less performance request
//
// One k6 iteration = one HTTP request.
//
// Example:
//
// K6_WORK=1000
//
// means:
//
// 1 HTTP request
//      ↓
// /performance/compute?work=1000
//      ↓
// 1,000 server-side computational iterations
//      ↓
// 1 HTTP response
// ============================================================

export default function () {
  const start = Date.now();

  const response = http.get(
    `${BASE_URL}/api/v1/performance/compute?work=${WORK}`,
    {
      tags: {
        endpoint: "performance-compute",
        work: String(WORK),
      },
    },
  );

  const successful = check(response, {
    "status is 200": (res) => res.status === 200,

    "response is JSON": (res) =>
      res.headers["Content-Type"]?.includes("application/json"),

    "success is true": (res) => {
      try {
        return res.json("success") === true;
      } catch {
        return false;
      }
    },

    "work matches requested value": (res) => {
      try {
        return Number(res.json("data.work")) === WORK;
      } catch {
        return false;
      }
    },
  });

  const duration = Date.now() - start;

  computeDuration.add(duration);

  if (successful) {
    computeCompleted.add(1);
  } else {
    computeFailed.add(1);
  }
}
