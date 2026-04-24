/**
 * Custom telemetry registry.
 *
 * k6 requires Trends/Counters/Rates to be constructed in the *init
 * context* — i.e. at module evaluation time, before the default function
 * runs. Lazy allocation inside the VU loop throws:
 *   "metrics must be declared in the init context"
 *
 * We therefore eagerly construct the bundle at module load. Every test
 * file that imports this module triggers init-time allocation, exactly
 * once per VU isolate. `telemetry()` is a thin getter that stays in the
 * public API in case we later want to swap implementations (Null object
 * for dry-run, fake for unit tests, etc.).
 */

import { Counter, Rate, Trend } from "k6/metrics";

export interface TelemetryBundle {
  readonly latency: Trend;          // per-request latency, tagged by endpoint
  readonly businessErrors: Counter; // non-HTTP failures (schema, auth, missing field)
  readonly retries: Counter;        // retry attempts triggered
  readonly successRate: Rate;       // 1 for success iteration, 0 otherwise
}

// Must be module-top-level so k6 allocates these in the init context.
const BUNDLE: TelemetryBundle = {
  latency:        new Trend("perf_latency_ms", true),
  businessErrors: new Counter("perf_business_errors"),
  retries:        new Counter("perf_retry_attempts"),
  successRate:    new Rate("perf_iteration_success"),
};

export function telemetry(): TelemetryBundle {
  return BUNDLE;
}

/**
 * Named flow Trends for multi-step user journeys.
 *
 * Same init-context rule — we pre-declare the known stage names here
 * so the Trends allocate at module load, not on first call.
 *
 * To add a new flow: add it to KNOWN_FLOWS. Asking for an unknown flow
 * throws at init rather than silently dropping samples.
 */
const KNOWN_FLOWS = ["login", "inventory", "cart", "checkout"] as const;
type KnownFlow = (typeof KNOWN_FLOWS)[number];

const FLOW_TRENDS: Record<KnownFlow, Trend> = KNOWN_FLOWS.reduce(
  (acc, name) => {
    acc[name] = new Trend(`scenario_${name}_ms`, true);
    return acc;
  },
  {} as Record<KnownFlow, Trend>,
);

export function flowTrend(name: string): Trend {
  const trend = FLOW_TRENDS[name as KnownFlow];
  if (!trend) {
    throw new Error(
      `flowTrend("${name}") — unknown flow. ` +
        `Add it to KNOWN_FLOWS in utils/metrics.ts so the Trend is allocated at init.`,
    );
  }
  return trend;
}
