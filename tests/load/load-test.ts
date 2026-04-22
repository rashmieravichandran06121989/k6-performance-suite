import { check, sleep } from "k6";
import http from "k6/http";
import { Options } from "k6/options";

export const options: Options = {
  stages: [
    { duration: "1m", target: 20 },
    { duration: "3m", target: 50 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<500", "p(99)<800"],
    http_req_failed: ["rate<0.01"],
    checks: ["rate>=0.95"],
  },
};

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

  sleep(1);

  const userId = Math.floor(Math.random() * 10) + 1;
  const singleRes = http.get(
    `https://jsonplaceholder.typicode.com/users/${userId}`,
    { headers: { "Content-Type": "application/json" } }
  );

  che