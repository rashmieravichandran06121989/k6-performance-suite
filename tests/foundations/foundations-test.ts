// tests/foundations/foundations-test.ts
// Day 1 — first k6 script. 10 VUs, 30s, basic checks and thresholds against reqres.in.

import { check, sleep } from "k6";
import http from "k6/http";
import { Options } from "k6/options";
import { BASE_URL, DEFAULT_HEADERS, GLOBAL_THRESHOLDS, tag } from "../../config/environments";
import { assertResponse, assertJsonKeys, thinkTime, logStep } from "../../utils/helpers";

export const options: Options = {
  vus: 10,
  duration: "30s",
  thresholds: {
    ...GLOBAL_THRESHOLDS,
    http_req_duration: ["p(95)<500", "p(99)<1000"],
  },
};

export default function () {
  logStep(`VU ${__VU} — GET /users`);
  const listRes = http.get(`${BASE_URL}/users?page=1`, {
    headers: DEFAULT_HEADERS,
    ...tag("foundations-list"),
  });
  assertResponse(listRes, 200, 500);
  assertJsonKeys(listRes, ["data", "total", "page"]);

  thinkTime(1, 2);

  const userId = Math.floor(Math.random() * 10) + 1;
  logStep(`VU ${__VU} — GET /users/${userId}`);
  const singleRes = http.get(`${BASE_URL}/users/${userId}`, {
    headers: DEFAULT_HEADERS,
    ...tag("foundations-single"),
  });
  assertResponse(singleRes, 200, 500);

  thinkTime(1, 2);

  logStep(`VU ${__VU} — POST /users`);
  const createRes = http.post(
    `${BASE_URL}/users`,
    JSON.stringify({ name: `VU-${__VU}`, job: "k6-tester" }),
    { headers: DEFAULT_HEADERS, ...tag("foundations-create") }
  );
  check(createRes, {
    "create: status 201": (r) => r.status === 201,
    "create: id present": (r) => {
      const body = JSON.parse(r.body as string);
      return typeof body.id !== "undefined";
    },
  });

  thinkTime(0.5, 1.5);
}
