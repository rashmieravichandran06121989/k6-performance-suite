/**
 * Foundations — baseline smoke at 10 VUs / 30s.
 * First test anyone runs after cloning. If this fails, don't bother
 * running the heavier tests.
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
  vus: 10,
  duration: "30s",
  thresholds: thresholdsFor("foundation"),
  tags: env.tags,
  noConnectionReuse: false,
  discardResponseBodies: false,
};

export default function (): void {
  const api = http_(env);

  const listRes = api
    .endpoint("users_list")
    .get(`${env.baseUrl}/users?_page=${cyclePage(__ITER, 2)}`);
  assertOk(listRes, "users_list", 200, 500);
  thinkTime(0.8, 1.4);

  const userRes = api
    .endpoint("user_detail")
    .get(`${env.baseUrl}/users/${pickUserId()}`);
  assertOk(userRes, "user_detail", 200, 500);
  thinkTime(0.8, 1.4);

  const seed = nextPost(__ITER);
  const createRes = api
    .endpoint("post_create")
    .post(`${env.baseUrl}/posts`, { ...seed, userId: __VU });
  assertOk(createRes, "post_create", 201, 500);
  thinkTime(0.8, 1.4);
}
