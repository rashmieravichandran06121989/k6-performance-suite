// tests/load/load-test.ts
// Day 2 — load test. Realistic production traffic at 50 VUs over 5 minutes.

import { check } from "k6";
import http from "k6/http";
import { Options } from "k6/options";
import { BASE_URL, DEFAULT_HEADERS, GLOBAL_THRESHOLDS, tag } from "../../config/environments";
import { assertResponse, assertJsonKeys, thinkTime, logStep } from "../../utils/helpers";

export const options: Options = {
  stages: [
    { duration: "1m", target: 20 },
    { duration: "3m", target: 50 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    ...GLOBAL_THRESHOLDS,
    http_req_duration: ["p(95)<500", "p(99)<800"],
  },
};

export default function () {
  const page = ((__ITER % 2) + 1);
  logStep(`VU ${__VU} — GET /users?page=${page}`);
  const listRes = http.get(`${BASE_URL}/users?page=${page}`, {
    headers: DEFAULT_HEADERS,
    ...tag("load-list"),
  });
  assertResponse(listRes, 200, 500);
  assertJsonKeys(listRes, ["data", "total"]);

  thinkTime(1, 3);

  const userId = Math.floor(Math.random() * 12) + 1;
  const singleRes = http.get(`${BASE_URL}/users/${userId}`, {
    headers: DEFAULT_HEADERS,
    ...tag("load-single"),
  });
  assertResponse(singleRes, 200, 500);

  thinkTime(1, 2);

  logStep(`VU ${__VU} — POST /register`);
  const registerRes = http.post(
    `${BASE_URL}/register`,
    JSON.stringify({ email: "eve.holt@reqres.in", password: "pistol" }),
    { headers: DEFAULT_HEADERS, ...tag("load-register") }
  );
  check(registerRes, {
    "register: status 200": (r) => r.status === 200,
    "register: token present": (r) => {
      const body = JSON.parse(r.body as string);
      return typeof body.token === "string" && body.token.length > 0;
    },
  });

  thinkTime(0.5, 1.5);
}
