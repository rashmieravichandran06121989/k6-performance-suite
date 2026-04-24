/**
 * Environment registry — single source of truth for base URLs, auth, and
 * connection tuning. Tests never hardcode a hostname; they call
 * `getEnv()` which resolves the active profile from the K6_ENV
 * environment variable (default: "sandbox").
 *
 * Promoting a test to a new environment is a one-line change:
 *   K6_ENV=staging k6 run tests/load/load-test.ts
 */

export type EnvName = "sandbox" | "dev" | "staging" | "prod";

export interface EnvConfig {
  readonly name: EnvName;
  readonly baseUrl: string;
  readonly sauceDemoUrl: string;
  /** Maximum request attempts per call (1 = no retry). */
  readonly maxAttempts: number;
  /** Per-attempt HTTP timeout. */
  readonly requestTimeout: string;
  /** Optional bearer token pulled from env at boot. */
  readonly authToken?: string;
  readonly defaultHeaders: Readonly<Record<string, string>>;
  /** Tag every request so metrics filter cleanly in Grafana. */
  readonly tags: Readonly<Record<string, string>>;
}

const COMMON_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  Accept: "application/json",
  "User-Agent": "k6-performance-suite/2.0",
};

const REGISTRY: Readonly<Record<EnvName, EnvConfig>> = {
  sandbox: {
    name: "sandbox",
    baseUrl: "https://jsonplaceholder.typicode.com",
    sauceDemoUrl: "https://www.saucedemo.com",
    maxAttempts: 3,
    requestTimeout: "10s",
    defaultHeaders: COMMON_HEADERS,
    tags: { env: "sandbox", suite: "k6-perf" },
  },
  dev: {
    name: "dev",
    baseUrl: __ENV.DEV_BASE_URL ?? "https://jsonplaceholder.typicode.com",
    sauceDemoUrl: "https://www.saucedemo.com",
    maxAttempts: 3,
    requestTimeout: "10s",
    authToken: __ENV.DEV_AUTH_TOKEN,
    defaultHeaders: COMMON_HEADERS,
    tags: { env: "dev", suite: "k6-perf" },
  },
  staging: {
    name: "staging",
    baseUrl: __ENV.STAGING_BASE_URL ?? "https://jsonplaceholder.typicode.com",
    sauceDemoUrl: "https://www.saucedemo.com",
    maxAttempts: 2,
    requestTimeout: "8s",
    authToken: __ENV.STAGING_AUTH_TOKEN,
    defaultHeaders: COMMON_HEADERS,
    tags: { env: "staging", suite: "k6-perf" },
  },
  prod: {
    name: "prod",
    baseUrl: __ENV.PROD_BASE_URL ?? "",
    sauceDemoUrl: "https://www.saucedemo.com",
    maxAttempts: 1, // never hammer prod on failure
    requestTimeout: "5s",
    authToken: __ENV.PROD_AUTH_TOKEN,
    defaultHeaders: COMMON_HEADERS,
    tags: { env: "prod", suite: "k6-perf" },
  },
};

/**
 * Resolve the active environment. Defaults to `sandbox` for local runs so
 * a developer cloning the repo can `k6 run` with zero setup.
 */
export function getEnv(): EnvConfig {
  const raw = (__ENV.K6_ENV ?? "sandbox").toLowerCase() as EnvName;
  const env = REGISTRY[raw];

  if (!env) {
    throw new Error(
      `Unknown environment "${raw}". Valid: ${Object.keys(REGISTRY).join(", ")}`,
    );
  }
  if (env.name === "prod" && !env.baseUrl) {
    throw new Error("PROD_BASE_URL must be set before running against prod.");
  }
  return env;
}
