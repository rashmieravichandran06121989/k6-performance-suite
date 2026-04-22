// utils/helpers.ts
// Shared assertions, custom metrics, think-time, and logging

import { check, sleep } from "k6";
import http, { RefinedResponse, ResponseType } from "k6/http";
import { Counter, Rate, Trend } from "k6/metrics";

export const errorRate = new Rate("custom_error_rate");
export const successCounter = new Counter("custom_success_count");
export const responseTimeTrend = new Trend("custom_response_time_ms", true);

export function assertResponse(
  res: RefinedResponse<ResponseType>,
  expectedStatus = 200,
  maxDurationMs = 500
): boolean {
  const passed = check(res, {
    [`status is ${expectedStatus}`]: (r) => r.status === expectedStatus,
    [`response time < ${maxDurationMs}ms`]: (r) => r.timings.duration < maxDurationMs,
    "response body is not empty": (r) => r.body !== null && r.body.toString().length > 0,
  });

  errorRate.add(!passed);
  responseTimeTrend.add(res.timings.duration);
  if (passed) successCounter.add(1);

  return passed;
}

export function assertJsonKeys(
  res: RefinedResponse<ResponseType>,
  keys: string[]
): boolean {
  return check(res, {
    "response is valid JSON": (r) => {
      try {
        JSON.parse(r.body as string);
        return true;
      } catch {
        return false;
      }
    },
    [`JSON contains keys: ${keys.join(", ")}`]: (r) => {
      try {
        const body = JSON.parse(r.body as string);
        return keys.every((k) => k in body || k in (body.data ?? {}));
      } catch {
        return false;
      }
    },
  });
}

// Randomised think time — keeps VU pacing realistic
export function thinkTime(minSec = 1, maxSec = 3): void {
  sleep(minSec + Math.random() * (maxSec - minSec));
}

export function logStep(step: string): void {
  console.log(`[${new Date().toISOString()}] ${step}`);
}
# custom metrics for error rate and response time
