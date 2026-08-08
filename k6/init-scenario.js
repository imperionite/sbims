import http from "k6/http";
import { check } from "k6";

const BASE_URL = __ENV.BASE_URL;
const EMAIL = __ENV.K6_EMAIL;
const PASSWORD = __ENV.K6_PASSWORD;

export const options = {
  stages: [
    // Warm-up phase
    { duration: "30s", target: 10 },

    // Formal measurement phase
    { duration: "3m", target: 10 },

    // Ramp down
    { duration: "0s", target: 0 },
  ],
};

export default function () {
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
    },
  );

  check(loginResponse, {
    "login completed": (response) => response.status === 200,
  });

  if (loginResponse.status !== 200) {
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
    return;
  }

  // ============================================================
  // 2. GET CURRENT USER
  // ============================================================

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };

  const meResponse = http.get(`${BASE_URL}/api/v1/auth/me`, authHeaders);

  check(meResponse, {
    "current user retrieved": (response) => response.status === 200,
  });

  // ============================================================
  // 3. GET USER ROLE
  // ============================================================

  const roleResponse = http.get(`${BASE_URL}/api/v1/auth/role`, authHeaders);

  check(roleResponse, {
    "user role retrieved": (response) => response.status === 200,
  });

  // ============================================================
  // 4. ADMINISTRATOR AUTHORIZATION CHECK
  // ============================================================

  const adminCheckResponse = http.get(
    `${BASE_URL}/api/v1/auth/admin-check`,
    authHeaders,
  );

  check(adminCheckResponse, {
    "administrator access granted": (response) => response.status === 200,
  });

  // ============================================================
  // 5. REFRESH TOKEN
  // ============================================================

  if (!refreshToken) {
    return;
  }

  const refreshResponse = http.post(
    `${BASE_URL}/api/v1/auth/refresh`,
    JSON.stringify({
      refresh_token: refreshToken,
    }),
    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  check(refreshResponse, {
    "token refresh completed": (response) => response.status === 200,
  });
}
