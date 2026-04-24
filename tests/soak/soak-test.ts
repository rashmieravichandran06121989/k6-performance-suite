/**
 * Soak — 30 VUs for 30 min. Watches for memory leaks, connection-pool
 * exhaustion, and drift in latency over time.
 *
 * Emits `soak_response_time_ms` and tags every request with the
 * elapsed-minute bucket so drift is visible per-bucket in Grafana.
 */

import { Options } from "k6/options";
import { Trend } from "k6/metrics";
import { getEnv } from "../../config/environments.ts";
import { thresholdsFor } from "../../config/thresholds.ts";
import { http_ } from "../../utils/http-client.ts";
import { assertOk, thinkTime } from "../../utils/helpers.ts";
import { cyclePage, nextPost, pickUserId } from "../../utils/data-factory.ts";

export { handleSummary } from "../../utils/summary.ts";

const env = getEnv();
const driftTrend = new Trend("soak_response_time_ms", true);

export const options: Options = {
  scenarios: {
    endurance: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "2m",  target: 30 },
        { duration: "26m", target: 30 },
        { duration: "2m",  target: 0 },
      ],
      gracefulRampDown: "1m",
      tags: { scenario: "endurance" },
    },
  },
  thresholds: {
    ...thresholdsFor("soak_endurance"),
    soak_response_time_ms: ["p(95)<500", "p(99)<800"],
  },
  tags: env.tags,
};

// Start timestamp captured once in init so every VU sees the same anchor.
const RUN_START = Date.now();

function elapsedBucket(): string {
  const minutes = Math.floor((Date.now() - RUN_START) / 60000);
  const bucket = Math.floor(minutes / 5) * 5;
  return `${bucket}-${bucket + 5}m`;
}

export function setup(): { startedAt: number } {
  console.log(`[soak] starting — ${env.name} — 30 VUs × 30 min`);
  return { startedAt: Date.now() };
}

export function teardown(ctx: { startedAt: number }): void {
  const mins = (Date.now() - ctx.startedAt) / 60000;
  console.log(`[soak] complete — ran ${mins.toFixed(1)}m — inspect soak_response_time_ms for drift`);
}

export default function (): void {
  const api = http_(env).tag("elapsed", elapsedBucket());

  const listRes = api
    .endpoint("users_list")
    .get(`${env.baseUrl}/users?_page=${cyclePage(__ITER, 2)}`);
  assertOk(listRes, "users_list", 200, 500);
  driftTrend.add(listRes.timings.duration);
  thinkTime(1.5, 2.5);

  const userRes = api
    .endpoint("user_detail")
    .get(`${env.baseUrl}/users/${pickUserId()}`);
  assertOk(userRes, "user_detail", 200, 500);
  driftTrend.add(userRes.timings.duration);
  thinkTime(0.8, 1.2);

  const seed = nextPost(__ITER);
  const createRes = api
    .endpoint("post_create")
    .post(`${env.baseUrl}/posts`, { ...seed, userId: __VU });
  assertOk(createRes, "post_create", 201, 500);
  driftTrend.add(createRes.timings.duration);

  // Every 5th iter: heavier endpoint so drift shows up on slow paths too.
  if (__ITER % 5 === 0) {
    const slowRes = api
      .endpoint("photos_slow")
      .get(`${env.baseUrl}/photos?_limit=10`);
    assertOk(slowRes, "photos_slow", 200, 800);
    driftTrend.add(slowRes.timings.duration);
  }

  thinkTime(1.5, 2.5);
}
