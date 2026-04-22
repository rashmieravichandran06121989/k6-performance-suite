// tests/stress/stress-test.ts
// Day 2 — stress test. Ramp 0 → 200 VUs to find the breaking point.
// Errors are expected around 150 VUs on reqres — that's the point.

import { check } from "k6";
import http from "k6/http";
import { Options } from "k6/options";
import { Trend } from "k6/metrics";
import { BASE_URL, DEFAULT_HEADERS, tag } from "../../config/environments";
import { assertResponse, thinkTime, logStep } from "../../utils/helpers";

const stressTrend = new Trend("stress_response_time_ms", true);

export const options: Options = {
  stages: [
    { duration: "2m", target: 50 },
    { duration: "3m", target: 100 },
    { duration: "3m", target: 150 },
    { duration: "2m", target: 200 },
    { duration: "2m", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<1000"],
    http_req_failed: ["rate<0.05"],
    checks: ["rate>=0.90"],
  },
};

export default function () {
  const page = ((__ITER % 3) + 1);
  const listRes = http.get(`${BASE_URL}/users?page=${page}`, {
    headers: DEFAULT_HEADERS,
    ...tag("stress-list"),
  });
  assertResponse(listRes, 200, 1000);
  stressTrend.add(listRes.timings.duration);

  thinkTime(0.5, 1);

  const userId = Math.floor(Math.random() * 12) + 1;
  const singleRes = http.get(`${BASE_URL}/users/${userId}`, {
    headers: DEFAULT_HEADERS,
    ...tag("stress-single"),
  });
  assertResponse(singleRes, 200, 1000);

  thinkTime(0.3, 0.8);

  logStep(`VU ${__VU} — POST /users (stress write)`);
  const createRes = http.post(
    `${BASE_URL}/users`,
    JSON.stringify({ name: `stress-vu-${__VU}`, job: "stress-tester" }),
    { headers: DEFAULT_HEADERS, ...tag("stress-create") }
  );
  check(createRes, { "stress create: 201": (r) => r.status === 201 });

  const patchRes = http.patch(
    `${BASE_URL}/users/${userId}`,
    JSON.stringify({ job: "updated" }),
    { headers: DEFAULT_HEADERS, ...tag("stress-patch") }
  );
  check(patchRes, {
    "stress patch: 200": (r) => r.status === 200,
    "stress patch: updatedAt present": (r) => {
      const body = JSON.parse(r.body as string);
      return typeof body.updatedAt !== "undefined";
    },
  });

  thinkTime(0.5, 1);
}
