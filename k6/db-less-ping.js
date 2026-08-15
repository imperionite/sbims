import http from "k6/http";
import { check } from "k6";
import { Counter, Trend } from "k6/metrics";

// ============================================================
// Configuration
// ============================================================

const BASE_URL = __ENV.K6_BASE_URL || "https://sbims-dev.imperionite.deno.net";

const RATE = Number(__ENV.K6_RATE || 0.5);
const RATE_PER_MINUTE = Math.round(RATE * 60);

const DURATION = __ENV.K6_DURATION || "1m";

// ============================================================
// Custom metrics
// ============================================================

const pingCompleted = new Counter("ping_completed");
const pingFailed = new Counter("ping_failed");
const pingDuration = new Trend("ping_duration");

// ============================================================
// k6 configuration
// ============================================================

export const options = {
  scenarios: {
    db_less_ping: {
      executor: "constant-arrival-rate",

      rate: RATE_PER_MINUTE,
      timeUnit: "1m",

      duration: DURATION,

      preAllocatedVUs: 5,
      maxVUs: 20,

      gracefulStop: "0s",
    },
  },
};

// ============================================================
// DB-less baseline request
// ============================================================

export default function () {
  const start = Date.now();

  const response = http.get(`${BASE_URL}/api/v1/performance/ping`, {
    tags: {
      endpoint: "performance-ping",
    },
  });

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
  });

  const duration = Date.now() - start;

  pingDuration.add(duration);

  if (successful) {
    pingCompleted.add(1);
  } else {
    pingFailed.add(1);
  }
}
