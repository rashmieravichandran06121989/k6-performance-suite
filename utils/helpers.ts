/**
 * Small helpers used across tests. Keep this file narrow — anything
 * substantial belongs in its own module (http-client, metrics,
 * data-factory, summary).
 */

import { sleep, check } from "k6";
import { RefinedResponse, ResponseType } from "k6/http";
import { telemetry } from "./metrics.ts";

/**
 * Pauses for a random interval in [minSec, maxSec). Simulates real
 * user think time between actions.
 */
export function thinkTime(minSec: number, maxSec: number): void {
  if (minSec < 0 || maxSec < minSec) {
    throw new Error(`thinkTime: invalid range [${minSec}, ${maxSec})`);
  }
  sleep(minSec + Math.random() * (maxSec - minSec));
}

/**
 * Applies a standard response assertion set and feeds both the built-in
 * `checks` metric and the custom latency Trend. Keeping the pattern in
 * one place means adding a new universal assertion is a one-line change.
 */
export function assertOk(
  res: RefinedResponse<ResponseType | undefined>,
  label: string,
  expectedStatus: number,
  latencyBudgetMs: number,
): boolean {
  const { latency, successRate } = telemetry();
  latency.add(res.timings.duration, { endpoint: label });

  const ok = check(
    res,
    {
      [`${label}: status ${expectedStatus}`]: (r) => r.status === expectedStatus,
      [`${label}: latency < ${latencyBudgetMs}ms`]: (r) =>
        r.timings.duration < latencyBudgetMs,
      [`${label}: body non-empty`]: (r) => typeof r.body === "string" && r.body.length > 0,
    },
    { endpoint: label },
  );

  successRate.add(ok);
  return ok;
}
