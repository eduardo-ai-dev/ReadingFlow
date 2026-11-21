import http from "k6/http";
import { check, sleep } from "k6";
import { enforceK6Safety } from "./safety.js";

const { appBaseUrl } = enforceK6Safety();
const TOTAL_USERS = Number(__ENV.LOADTEST_USERS || 20);
const SEED = Number(__ENV.LOADTEST_SEED || 20261121);

export const options = {
  vus: Number(__ENV.LOADTEST_VUS || 20),
  iterations: Number(__ENV.LOADTEST_ITERATIONS || 60),
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1500"],
  },
};

export default function runMutationsBurst() {
  const userIdx = ((__VU - 1) % TOTAL_USERS) + 1;
  const sessionToken = `lt-sess-user-${userIdx}-seed-${SEED}`;
  const readingId = `reading-lt-${userIdx}-1`;
  const unlockedEditionId = `ed-lt-${userIdx}-1`;

  const reqParams = {
    headers: { "Content-Type": "application/json" },
    cookies: { rf_session_id: sessionToken },
  };

  // 1. Atualização de progresso em rajada
  const progRes = http.post(
    `${appBaseUrl}/api/internal/loadtest`,
    JSON.stringify({
      action: "updateReadingProgress",
      payload: {
        readingId,
        progressUnit: "pages",
        progressValue: 25 + (__ITER % 50),
      },
    }),
    reqParams
  );
  check(progRes, {
    "progresso HTTP 200": (r) => r.status === 200,
  });

  // 2. Troca de capa / upload validado (<= 300 KB)
  const coverRes = http.post(
    `${appBaseUrl}/api/internal/loadtest`,
    JSON.stringify({
      action: "updateEditionCover",
      payload: {
        editionId: unlockedEditionId,
        coverUrl: "http://127.0.0.1:4110/covers/mock-cover-1.webp",
        coverSource: "openlibrary",
        sourceAction: "manual",
      },
    }),
    reqParams
  );
  check(coverRes, {
    "capa atualizada e travada": (r) =>
      r.status === 200 && r.json("coverLocked") === true,
  });

  // 3. Reordenação de estante com posições 0..N-1 contíguas
  const reorderRes = http.post(
    `${appBaseUrl}/api/internal/loadtest`,
    JSON.stringify({
      action: "reorderShelfBooks",
      payload: {
        itemIds: [
          `item-lt-${userIdx}-2`,
          `item-lt-${userIdx}-1`,
          `item-lt-${userIdx}-3`,
        ],
      },
    }),
    reqParams
  );
  check(reorderRes, {
    "reordenação HTTP 200": (r) => r.status === 200,
  });

  sleep(0.1);
}
