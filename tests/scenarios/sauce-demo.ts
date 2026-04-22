import { check, sleep, group } from "k6";
import http from "k6/http";
import { Options } from "k6/options";
import { Trend } from "k6/metrics";

const loginTrend     = new Trend("scenario_login_ms",     true);
const inventoryTrend = new Trend("scenario_inventory_ms", true);
const cartTrend      = new Trend("scenario_cart_ms",      true);
const checkoutTrend  = new Trend("scenario_checkout_ms",  true);

export const options: Options = {
  stages: [
    { duration: "1m", target: 25  },
    { duration: "3m", target: 100 },
    { duration: "1m", target: 0   },
  ],
  thresholds: {
    http_req_duration:     ["p(95)<500"],
    http_req_failed:       ["rate<0.01"],
    checks:                ["rate>=0.95"],
    scenario_login_ms:     ["p(95)<300"],
    scenario_inventory_ms: ["p(95)<400"],
    scenario_cart_ms:      ["p(95)<300"],
    scenario_checkout_ms:  ["p(95)<300"],
  },
};

export default function () {
  group("login", () => {
    const res = http.get("https://www.saucedemo.com/");
    loginTrend.add(res.timings.duration);
    check(res, {
      "login page: status 200": (r) => r.status === 200,
      "login page: response < 500ms": (r) => r.timings.duration < 500,
    });
    sleep(1);
  });

  group("browse inventory", () => {
    const res = http.get("https://www.saucedemo.com/inventory.html");
    inventoryTrend.add(res.timings.duration);
    check(res, {
      "inventory: status 200": (r) => r.status === 200,
      "inventory: response < 500ms": (r) => r.timings.duration < 500,
    });
    sleep(1);
  });

  group("cart", () => {
    const res = http.get("https://www.saucedemo.com/cart.html");
    cartTrend.add(res.timings.duration);
    check(res, {
      "cart: status 200": (r) => r.status === 200,
      "cart: response < 500ms": (r) => r.timings.duration < 500,
    });
    sleep(1);
  });

  group("checkout", () => {
    const res = http.get("https://www.saucedemo.com/checkout-step-one.html");
    checkoutTrend.add(res.timings.duration);
    check(res, {
      "checkout: status 200": (r) => r.status === 200,
      "checkout: response < 500ms": (r) => r.timings.duration < 500,
    });
    sleep(1);
  });
}