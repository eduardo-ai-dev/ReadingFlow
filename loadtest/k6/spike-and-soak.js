import http from "k6/http";
import { check, sleep } from "k6";
import { enforceK6Safety } from "./safety.js";

const { appBaseUrl } = enforceK6Safety();
const TOTAL_USERS = Number(__ENV.LOADTEST_USERS || 20);
const SEED = Number(__ENV.LOADTEST_SEED || 20261121);

export const options = {
  scenarios: {
    spike_10x: {
      executor: "ramping-vus",
      startVUs: 5,
      stages: [
        { duration: "5s", target: 5 },
        { duration: "10s", target: 50 }, // 10x spike in 10s
        { duration: "15s", target: 5 }, // recovery
      ],
    },
    soak_moderate: {
      executor: "constant-vus",
      vus: Number(__ENV.LOADTEST_SOAK_VUS || 15),
      duration: __ENV.LOADTEST_SOAK_DURATION || "2m",
      startTime: "30s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1500"],
  },
};

export default function runSpikeAndSoak() {
  const userIdx = ((__VU - 1) % TOTAL_USERS) + 1;
  const sessionToken = `lt-sess-user-${userIdx}-seed-${SEED}`;
  const res = http.get(`${appBaseUrl}/painel`, {
    cookies: { rf_session_id: sessionToken },
  });
  check(res, {
    "status 200": (r) => r.status === 200,
  });
  sleep(0.2);
}
