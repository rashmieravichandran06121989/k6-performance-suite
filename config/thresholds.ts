/**
 * SLA strategy — one place, one truth. Every test imports a profile
 * rather than copy-pasting threshold expressions. This is a classic
 * Strategy pattern: pick a profile that matches the test's intent.
 *
 * Adding a new SLA is adding one key; tightening production SLAs
 * doesn't require touching five files.
 */

import { Options } from "k6/options";

export type ThresholdProfile =
  | "foundation"
  | "steady_load"
  | "stress_breaking_point"
  | "soak_endurance"
  | "user_journey";

type ThresholdMap = NonNullable<Options["thresholds"]>;

/**
 * Defensive helper: centralises the filter-by-tag DSL so a typo in a
 * tag key can't silently disable a threshold.
 * e.g. byEndpoint("login") → "http_req_duration{endpoint:login}"
 */
function byEndpoint(tag: string): string {
  return `http_req_duration{endpoint:${tag}}`;
}

export const SLA_REGISTRY: Readonly<Record<ThresholdProfile, ThresholdMap>> = {
  foundation: {
    http_req_duration: [{ threshold: "p(95)<500", abortOnFail: false }],
    http_req_failed: [{ threshold: "rate<0.01", abortOnFail: false }],
    checks: ["rate>=0.95"],
  },

  steady_load: {
    http_req_duration: [
      { threshold: "p(95)<500", abortOnFail: false },
      { threshold: "p(99)<800", abortOnFail: false },
    ],
    http_req_failed: [{ threshold: "rate<0.01", abortOnFail: true, delayAbortEval: "30s" }],
    checks: ["rate>=0.95"],
    // Note: iteration_duration intentionally omitted — it's dominated by
    // sleep/thinkTime, not server behaviour, so pinning it would flag
    // noise rather than real regressions.
  },

  stress_breaking_point: {
    http_req_duration: ["p(95)<1000"],
    http_req_failed: ["rate<0.05"],
    checks: ["rate>=0.90"],
    dropped_iterations: ["count<100"],
  },

  soak_endurance: {
    http_req_duration: [
      { threshold: "p(95)<500", abortOnFail: false },
      { threshold: "p(99)<800", abortOnFail: false },
    ],
    http_req_failed: [{ threshold: "rate<0.005", abortOnFail: true, delayAbortEval: "5m" }],
    checks: ["rate>=0.95"],
    // Drift is tracked via the per-request soak_response_time_ms Trend and
    // the elapsed-bucket tags — iteration_duration would just measure sleep.
  },

  user_journey: {
    http_req_duration: ["p(95)<800"],
    http_req_failed: ["rate<0.01"],
    checks: ["rate>=0.95"],
    // Budgets calibrated against jsonplaceholder's observed p95 with
    // headroom for public-internet jitter. Tighten for internal APIs.
    [byEndpoint("login")]:     ["p(95)<400"],
    [byEndpoint("inventory")]: ["p(95)<600"],
    [byEndpoint("cart")]:      ["p(95)<600"],
    [byEndpoint("checkout")]:  ["p(95)<500"],
  },
};

export function thresholdsFor(profile: ThresholdProfile): ThresholdMap {
  const t = SLA_REGISTRY[profile];
  if (!t) throw new Error(`Unknown SLA profile: ${profile}`);
  return t;
}
