/**
 * Load — ramp to 20, hold at 50 for 3m, ramp down. Mimics a busy hour.
 *
 * Uses k6 scenarios rather than the top-level stages shorthand so we
 * can name the executor and attach exec tags — makes Grafana drill-down
 * straightforward.
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
    steady_hour: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 20 },
        { duration: "3m", target: 50 },
        { duration: "1m", target: 0 },
      ],
      gracefulRampDown: "30s",
      tags: { scenario: "steady_hour" },
    },
  },
  thresholds: thresholdsFor("steady_load"),
  tags: env.tags,
};

export default function (): void {
  const api = http_(env);

  const listRes = api
    .endpoint("users_list")
    .get(`${env.baseUrl}/users?_page=${cyclePage(__ITER, 2)}`);
  assertOk(listRes, "users_list", 200, 500);
  thinkTime(0.5, 1.5);

  const userRes = api
    .endpoint("user_detail")
    .get(`${env.baseUrl}/users/${pickUserId()}`);
  assertOk(userRes, "user_detail", 200, 500);
  thinkTime(0.5, 1.5);

  const seed = nextPost(__ITER);
  const createRes = api
    .endpoint("post_create")
    .post(`${env.baseUrl}/posts`, { ...seed, userId: __VU });
  assertOk(createRes, "post_create", 201, 500);
  thinkTime(0.5, 1.5);
}
