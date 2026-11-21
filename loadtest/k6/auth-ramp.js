import http from "k6/http";
import { check, sleep } from "k6";
import { enforceK6Safety } from "./safety.js";

const { appBaseUrl } = enforceK6Safety();
const TOTAL_USERS = Number(__ENV.LOADTEST_USERS || 20);
const PASSWORD = __ENV.LOADTEST_PASSWORD || "LoadTest#2026!";

export const options = {
  scenarios: {
    simultaneous_logins: {
      executor: "ramping-vus",
      startVUs: 1,
      stages: [
        { duration: "20s", target: 50 },
        { duration: "25s", target: 100 },
        { duration: "15s", target: 0 },
      ],
      gracefulRampDown: "5s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1000"],
  },
};

export default function runAuthRamp() {
  const userIdx = ((__VU - 1) % TOTAL_USERS) + 1;
  const email = `loadtest+${userIdx}@example.test`;

  // 1. Login
  const loginRes = http.post(
    `${appBaseUrl}/api/internal/loadtest`,
    JSON.stringify({
      action: "signIn",
      email,
      password: PASSWORD,
      rememberMe: true,
    }),
    { headers: { "Content-Type": "application/json" } }
  );

  check(loginRes, {
    "login HTTP 200": (r) => r.status === 200,
    "login ok=true": (r) => r.json("ok") === true,
  });

  // 2. Refresh de sessão paralelo (múltiplas sessões por usuário)
  const refreshRes = http.post(
    `${appBaseUrl}/api/internal/loadtest`,
    JSON.stringify({
      action: "refreshSession",
      keepOldSession: true,
    }),
    { headers: { "Content-Type": "application/json" } }
  );

  check(refreshRes, {
    "refresh HTTP 200": (r) => r.status === 200,
    "refresh email isolado": (r) => r.json("email") === email,
  });

  // 3. Logout ao final do ciclo
  const logoutRes = http.post(
    `${appBaseUrl}/api/internal/loadtest`,
    JSON.stringify({ action: "signOut" }),
    { headers: { "Content-Type": "application/json" } }
  );

  check(logoutRes, {
    "logout HTTP 200": (r) => r.status === 200,
  });

  sleep(0.2);
}
