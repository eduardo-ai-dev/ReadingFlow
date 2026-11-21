import http from "k6/http";
import { check, sleep } from "k6";
import { enforceK6Safety } from "./safety.js";

const { appBaseUrl } = enforceK6Safety();
const TOTAL_USERS = Number(__ENV.LOADTEST_USERS || 20);
const SEED = Number(__ENV.LOADTEST_SEED || 20261121);

export const options = {
  vus: Number(__ENV.LOADTEST_VUS || 50),
  duration: __ENV.LOADTEST_DURATION || "45s",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1500"],
  },
};

export default function runAuthenticatedNav() {
  const userIdx = ((__VU - 1) % TOTAL_USERS) + 1;
  const expectedUserId = `user-loadtest-${userIdx}`;
  const expectedEmail = `loadtest+${userIdx}@example.test`;
  const sessionToken = `lt-sess-user-${userIdx}-seed-${SEED}`;
  const workId = `work-lt-${userIdx}-1`;

  const params = {
    cookies: {
      rf_session_id: sessionToken,
    },
  };

  const routes = [
    "/painel",
    "/estantes",
    "/estante-3d",
    `/livros/${workId}`,
    "/api/catalog/search?q=Dom+Casmurro",
    "/leitura",
    "/estatisticas",
  ];

  for (const route of routes) {
    const res = http.get(`${appBaseUrl}${route}`, params);
    check(res, {
      [`${route} status 200`]: (r) => r.status === 200,
      [`${route} zero 5xx`]: (r) => r.status < 500,
    });
  }

  // Verificação estrita de isolamento entre usuários sob concorrência e cache
  const whoami = http.get(
    `${appBaseUrl}/api/internal/loadtest?mode=whoami`,
    params
  );
  check(whoami, {
    "whoami status 200": (r) => r.status === 200,
    "isolamento estrito userId": (r) => r.json("userId") === expectedUserId,
    "isolamento estrito email": (r) => r.json("email") === expectedEmail,
    "todos os exemplares pertencem ao próprio usuário": (r) =>
      r.json("allItemOwnersMatch") === true,
  });

  sleep(0.25);
}
