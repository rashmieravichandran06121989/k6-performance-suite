// tests/soak/soak-test.ts
// Day 2 — soak test. 30 VUs for 30 minutes.
// If p(95) climbs after the 15m mark, you likely have a connection leak.
// I run this overnight or as a blocking gate on main branch only.

import { check } from "k6";
import http from "k6/http";
import { Options } from "k6/options";
import { Trend } from "k6/metrics";
import { BASE_URL, DEFAULT_HEADERS, GLOBAL_THRESHOLDS, tag } from "../../config/environments";
import { assertResponse, assertJsonKeys, thinkTime, logStep } from "../../utils/helpers";

const soakTrend = new Trend("soak_response_time_ms", true);

export const options: Options = {
  stages: [
    { duration: "2m",  target: 30 },
    { duration: "26m", target: 30 },
    { duration: "2m",  target: 0 },
  ],
  thresholds: {
    ...GLOBAL_THRESHOLDS,
    http_req_failed: ["rate<0.005"],
    soak_response_time_ms: ["p(95)<500", "p(99)<800"],
  },
};

export function setup() {
  console.log("soak test starting — 30 VUs for 30 min against reqres.in");
}

export function teardown() {
  console.log("soak complete — check soak_response_time_ms trend for drift");
}

export default function () {
  const page = ((__ITER % 2) + 1);
  const listRes = http.get(`${BASE_URL}/users?page=${page}`, {
    headers: DEFAULT_HEADERS,
    ...tag("soak-list"),
  });
  assertResponse(listRes, 200, 500);
  assertJsonKeys(listRes, ["data", "total", "per_page"]);
  soakTrend.add(listRes.timings.duration);

  thinkTime(2, 4);

  const userId = Math.floor(Math.random() * 12) + 1;
  const singleRes = http.get(`${BASE_URL}/users/${userId}`, {
    headers: DEFAULT_HEADERS,
    ...tag("soak-single"),
  });
  assertResponse(singleRes, 200, 500);
  soakTrend.add(singleRes.timings.duration);

  thinkTime(1, 3);

  const loginRes = http.post(
    `${BASE_URL}/login`,
    JSON.stringify({ email: "eve.holt@reqres.in", password: "cityslicka" }),
    { headers: DEFAULT_HEADERS, ...tag("soak-login") }
  );
  check(loginRes, {
    "soak login: 200": (r) => r.status === 200,
    "soak login: token present": (r) => {
      const body = JSON.parse(r.body as string);
      return typeof body.token === "string";
    },
  });
  soakTrend.add(loginRes.timings.duration);

  // every 5th iteration test the delayed endpoint
  if (__ITER % 5 === 0) {
    const delayedRes = http.get(`${BASE_URL}/users?delay=2`, {
      headers: DEFAULT_HEADERS,
      ...tag("soak-delayed"),
      timeout: "10s",
    });
    check(delayedRes, { "delayed: 200": (r) => r.status === 200 });
    soakTrend.add(delayedRes.timings.duration);
  }

  thinkTime(1, 2);
}
