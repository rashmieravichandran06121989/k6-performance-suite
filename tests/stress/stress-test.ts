import { check, sleep } from "k6";
import http from "k6/http";
import { Options } from "k6/options";
import { Trend } from "k6/metrics";

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
    stress_response_time_ms: ["p(95)<1000"],
  },
};

export default function () {
  const page = ((__ITER % 3) + 1);

  const listRes = http.get(
    `https://jsonplaceholder.typicode.com/users?_page=${page}`,
    { headers: { "Content-Type": "application/json" } }
  );

  check(listRes, {
    "list: status 200": (r) => r.status === 200,
    "list: response < 1000ms": (r) => r.timings.duration < 1000,
  });

  stressTrend.add(listRes.timings.duration);

  sleep(0.5);

  const userId = Math.floor(Math.random() * 10) + 1;
  const singleRes = http.get(
    `https://jsonplaceholder.typicode.com/users/${userId}`,
    { headers: { "Content-Type": "application/json" } }
  );

  check(singleRes, {
    "single: status 200": (r) => r.status === 200,
    "single: response < 1000ms": (r) => r.timings.duration < 1000,
  });

  stressTrend.add(singleRes.timings.duration);

  sleep(0.3);

  const createRes = http.post(
    "https://jsonplaceholder.typicode.com/posts",
    JSON.stringify({ title: `stress-vu-${__VU}`, body: "stress test", userId: __VU }),
    { headers: { "Content-Type": "application/json" } }
  );

  check(createRes, {
    "create: status 201": (r) => r.status === 201,
  });

  const patchRes = http.patch(
    `https://jsonplaceholder.typicode.com/posts/${userId}`,
    JSON.stringify({ title: "updated" }),
    { headers: { "Content-Type": "application/json" } }
  );

  check(patchRes, {
    "patch: status 200": (r) => r.status === 200,
  });

  sleep(0.5);
}