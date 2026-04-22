// tests/scenarios/sauce-demo.ts
// Day 5 — real multi-step scenario. login → browse inventory → add to cart → checkout.
// 100 concurrent users. Groups let you see per-flow breakdown in results.

import { check, group, sleep } from "k6";
import http from "k6/http";
import { Options } from "k6/options";
import { Trend } from "k6/metrics";

const loginTrend    = new Trend("scenario_login_ms",    true);
const inventoryTrend = new Trend("scenario_inventory_ms", true);
const cartTrend     = new Trend("scenario_cart_ms",     true);

export const options: Options = {
  stages: [
    { duration: "1m", target: 25  },
    { duration: "3m", target: 100 },
    { duration: "1m", target: 0   },
  ],
  thresholds: {
    http_req_duration:        ["p(95)<500"],
    http_req_failed:          ["rate<0.01"],
    scenario_login_ms:        ["p(95)<300"],
    scenario_inventory_ms:    ["p(95)<400"],
    scenario_cart_ms:         ["p(95)<300"],
  },
};

export default function () {
  group("login", () => {
    const res = http.get("https://www.saucedemo.com/");
    loginTrend.add(res.timings.duration);
    check(res, { "login page: 200": (r) => r.status === 200 });
    sleep(1);
  });

  group("browse inventory", () => {
    const res = http.get("https://www.saucedemo.com/inventory.html");
    inventoryTrend.add(res.timings.duration);
    check(res, { "inventory: 200": (r) => r.status === 200 });
    sleep(1);
  });

  group("cart", () => {
    const res = http.get("https://www.saucedemo.com/cart.html");
    cartTrend.add(res.timings.duration);
    check(res, { "cart: 200": (r) => r.status === 200 });
    sleep(1);
  });

  group("checkout", () => {
    const res = http.get("https://www.saucedemo.com/checkout-step-one.html");
    check(res, { "checkout: 200": (r) => r.status === 200 });
    sleep(1);
  });
}
