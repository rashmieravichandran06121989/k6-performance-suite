// config/environments.ts
// Base URLs, global thresholds, and shared HTTP config

export const BASE_URLS = {
  reqres: "https://reqres.in/api",
  sauceDemo: "https://www.saucedemo.com",
} as const;

export type EnvKey = keyof typeof BASE_URLS;

export const ACTIVE_ENV: EnvKey = ((__ENV.TARGET as EnvKey) ?? "reqres") as EnvKey;
export const BASE_URL = BASE_URLS[ACTIVE_ENV];

export const GLOBAL_THRESHOLDS = {
  http_req_duration: ["p(95)<500"],
  http_req_failed: ["rate<0.01"],
  checks: ["rate>=0.95"],
};

export const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
};

export const tag = (name: string) => ({ tags: { name } });
# shared config and environment helpers
