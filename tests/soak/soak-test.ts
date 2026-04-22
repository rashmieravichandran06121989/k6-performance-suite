import { check, sleep } from "k6";
import http from "k6/http";
import { Options } from "k6/options";
import { Trend } from "k6/metrics";

const soakTrend = new Trend("soak_response_time_ms", true);

export const options: Options = {
  stages: [
    { duration: "2m",  target: 30 },
    { duration: "26m", target: 30 },
    { duration: "2m",  target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.005"],
    checks: ["rate>=0.95"],
    soak_response_time_ms: ["p(95)<500", "p(99)<800"],
  },
};

export function setup() {
  console.log("soak test starting — 30 VUs for 30 min against jsonplaceholder");
}

export function teardown() {
  console.log("soak complete — check soak_response_time_ms trend for drift");
}

export default function () {
  const page = ((__ITER % 2) + 1);

  const listRes = http.get(
    `https://jsonplaceholder.typicode.com/users?_page=${page}`,
    { headers: { "Content-Type": "application/json" } }
  );

  check(listRes, {
    "list: status 200": (r) => r.status === 200,
    "list: response < 500ms": (r) => r.timings.duration < 500,
  });

  soakTrend.add(listRes.timings.duration);

  sleep(2);

  const userId = Math.floor(Math.random() * 10) + 1;
  const singleRes = http.get(
    `https://jsonplaceholder.typicode.com/users/${userId}`,
    { headers: { "Content-Type": "application/json" } }
  );

  check(singleRes, {
    "single: status 200": (r) => r.status === 200,
    "single: response < 500ms": (r) => r.timings.duration < 500,
  });

  soakTrend.add(singleRes.timings.duration);

  sleep(1);

  const createRes = http.post(
    "https://jsonplaceholder.typicode.com/posts",
    JSON.stringify({ title: "soak test", body: "endurance run", userId: __VU }),
    { headers: { "Content-Type": "application/json" } }
  );

  check(createRes, {
    "create: status 201": (r) => r.status === 201,
  });

  soakTrend.add(createRes.timings.duration);

  // every 5th iteration hit a slower endpoint
  if (__ITER % 5 === 0) {
    const slowRes = http.get(
      "https://jsonplaceholder.typicode.com/photos?_limit=10",
      { headers: { "Content-Type": "application/json" } }
    );
    check(slowRes, {
      "slow endpoint: status 200": (r) => r.status === 200,
    });
    soakTrend.add(slowRes.timings.duration);
  }

  sleep(2);
}