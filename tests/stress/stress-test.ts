/**
 * Stress — 0 → 200 VUs to find the breaking point.
 *
 * Uses ramping-arrival-rate so we apply a request-rate ceiling rather
 * than a VU count — VU-based stress hides server-side saturation
 * because slowing responses throttle the pressure. Arrival rate keeps
 * pressure constant as the target degrades.
 */

import { Options } from "k6/options";
import { getEnv } from "../../config/environments.ts";
import { thresholdsFor } from "../../config/thresholds.ts";
import { http_ } from "../../utils/http-client.ts";
import { assertOk, thinkTime } from "../../utils/helpers.ts";
import { cyclePage, nextPost, pickUserId } from "../../utils/data-factory.ts";

export { handleSummary } from "../../utils/summary.ts";

const env = getEnv();

export const options: Options = {
  scenarios: {
    breaking_point: {
      executor: "ramping-arrival-rate",
      startRate: 20,
      timeUnit: "1s",
      preAllocatedVUs: 50,
      maxVUs: 400,
      stages: [
        { duration: "2m", target: 50 },
        { duration: "3m", target: 100 },
        { duration: "3m", target: 150 },
        { duration: "2m", target: 200 },
        { duration: "2m", target: 0 },
      ],
      tags: { scenario: "breaking_point" },
    },
  },
  thresholds: thresholdsFor("stress_breaking_point"),
  tags: env.tags,
};

export default function (): void {
  const api = http_(env).maxAttempts(1); // don't mask breakage with retries

  const listRes = api
    .endpoint("users_list")
    .get(`${env.baseUrl}/users?_page=${cyclePage(__ITER, 3)}`);
  assertOk(listRes, "users_list", 200, 1000);
  thinkTime(0.3, 0.7);

  const userRes = api
    .endpoint("user_detail")
    .get(`${env.baseUrl}/users/${pickUserId()}`);
  assertOk(userRes, "user_detail", 200, 1000);
  thinkTime(0.2, 0.5);

  const seed = nextPost(__ITER);
  const createRes = api
    .endpoint("post_create")
    .post(`${env.baseUrl}/posts`, { ...seed, userId: __VU });
  assertOk(createRes, "post_create", 201, 1000);

  const patchRes = api
    .endpoint("post_patch")
    .patch(`${env.baseUrl}/posts/${pickUserId()}`, { title: seed.title });
  assertOk(patchRes, "post_patch", 200, 1000);

  thinkTime(0.3, 0.7);
}
