/**
 * E-commerce user journey.
 *
 * Pattern: four-step shopper flow mapped onto jsonplaceholder's stable
 * endpoints so we exercise a real multi-step HTTP sequence without
 * depending on a client-side SPA (the earlier Sauce Demo target was a
 * React app — `/inventory.html`, `/cart.html`, `/checkout-step-one.html`
 * all 404 at the origin because they're JS routes, not files).
 *
 * Step → endpoint mapping:
 *   login     → GET  /users/{id}          (resolve the shopper)
 *   inventory → GET  /users/{id}/posts    (browse items)
 *   cart      → GET  /users/{id}/todos    (review cart)
 *   checkout  → POST /posts               (submit order)
 *
 * Per-flow Trends + per-endpoint SLAs drive the Grafana drill-downs.
 */

import { Options } from "k6/options";
import { check, group } from "k6";
import http from "k6/http";
import { getEnv } from "../../config/environments.ts";
import { thresholdsFor } from "../../config/thresholds.ts";
import { flowTrend, telemetry } from "../../utils/metrics.ts";
import { thinkTime } from "../../utils/helpers.ts";
import { nextPost, pickUserId } from "../../utils/data-factory.ts";

export { handleSummary } from "../../utils/summary.ts";

const env = getEnv();

export const options: Options = {
  scenarios: {
    shopper: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 25  },
        { duration: "3m", target: 100 },
        { duration: "1m", target: 0   },
      ],
      gracefulRampDown: "30s",
      tags: { scenario: "shopper" },
    },
  },
  thresholds: thresholdsFor("user_journey"),
  tags: env.tags,
};

const login     = flowTrend("login");
const inventory = flowTrend("inventory");
const cart      = flowTrend("cart");
const checkout  = flowTrend("checkout");

export default function (): void {
  const userId = pickUserId();
  const baseParams = {
    headers: env.defaultHeaders,
    redirects: 5,
  };

  group("01_login", () => {
    const res = http.get(`${env.baseUrl}/users/${userId}`, {
      ...baseParams,
      tags: { endpoint: "login" },
    });
    login.add(res.timings.duration);
    check(
      res,
      {
        "login: status 200":           (r) => r.status === 200,
        "login: body has user email":  (r) => typeof r.body === "string" && (r.body as string).indexOf("@") !== -1,
      },
      { endpoint: "login" },
    );
    thinkTime(0.6, 1.2);
  });

  group("02_inventory", () => {
    const res = http.get(`${env.baseUrl}/users/${userId}/posts`, {
      ...baseParams,
      tags: { endpoint: "inventory" },
    });
    inventory.add(res.timings.duration);
    check(
      res,
      {
        "inventory: status 200":      (r) => r.status === 200,
        "inventory: non-empty list":  (r) => typeof r.body === "string" && (r.body as string).charAt(0) === "[",
      },
      { endpoint: "inventory" },
    );
    thinkTime(0.6, 1.2);
  });

  group("03_cart", () => {
    const res = http.get(`${env.baseUrl}/users/${userId}/todos`, {
      ...baseParams,
      tags: { endpoint: "cart" },
    });
    cart.add(res.timings.duration);
    check(
      res,
      {
        "cart: status 200":        (r) => r.status === 200,
        "cart: non-empty list":    (r) => typeof r.body === "string" && (r.body as string).charAt(0) === "[",
      },
      { endpoint: "cart" },
    );
    thinkTime(0.4, 1.0);
  });

  group("04_checkout", () => {
    const seed = nextPost(__ITER);
    const res = http.post(
      `${env.baseUrl}/posts`,
      JSON.stringify({ title: `order-${userId}-${__ITER}`, body: seed.body, userId }),
      { ...baseParams, tags: { endpoint: "checkout" } },
    );
    checkout.add(res.timings.duration);
    const ok = check(
      res,
      {
        "checkout: status 201":        (r) => r.status === 201,
        "checkout: returned order id": (r) => typeof r.body === "string" && (r.body as string).indexOf('"id"') !== -1,
      },
      { endpoint: "checkout" },
    );
    if (!ok) telemetry().businessErrors.add(1, { stage: "checkout" });
    thinkTime(0.4, 1.0);
  });

  telemetry().successRate.add(true);
}
