/**
 * @deprecated — renamed to ecommerce-journey.ts.
 *
 * The Sauce Demo target (www.saucedemo.com) is a React SPA whose
 * `/inventory.html`, `/cart.html`, and `/checkout-step-one.html` paths
 * return 404 — they're client-side routes, not server files — so any
 * multi-step HTTP test against them is unsound.
 *
 * Re-export so existing scripts keep working while we migrate.
 */

export * from "./ecommerce-journey.ts";
export { handleSummary } from "../../utils/summary.ts";
