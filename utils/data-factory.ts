/**
 * Test-data factory backed by SharedArray.
 *
 * SharedArray materialises data once in the main isolate and exposes a
 * read-only view to every VU — critical for memory at 200+ VUs.
 *
 * `nextPost()` rotates through a realistic pool rather than shipping the
 * same "k6 test" / "load test" string on every POST, which can trigger
 * server-side de-duplication and skew numbers.
 */

import { SharedArray } from "k6/data";

interface PostSeed {
  readonly title: string;
  readonly body: string;
}

const SEEDS: ReadonlyArray<PostSeed> = [
  { title: "checkout regression sweep", body: "order placed, awaiting fulfilment" },
  { title: "inventory sync audit",      body: "reconciling warehouse counts against WMS" },
  { title: "auth flow smoke",           body: "SSO + MFA happy path" },
  { title: "cart pricing recalc",       body: "tax engine round-trip" },
  { title: "user preferences update",   body: "timezone + locale" },
  { title: "webhook retry",             body: "idempotency key present" },
  { title: "search query",              body: "q=shoes&size=42&color=black" },
  { title: "shipping estimate",         body: "origin NL, destination DE" },
];

export const POST_POOL = new SharedArray<PostSeed>("post_seed_pool", () => {
  return SEEDS.slice();
});

export function nextPost(iter: number): PostSeed {
  // Deterministic rotation per iteration — reproducible runs.
  const safeIter = Number.isFinite(iter) && iter >= 0 ? iter : 0;
  return POST_POOL[safeIter % POST_POOL.length];
}

/**
 * User ID selector — uniformly distributed across the known range on
 * jsonplaceholder (1..10). Kept here so the "magic 10" is not scattered.
 */
export function pickUserId(): number {
  return 1 + Math.floor(Math.random() * 10);
}

/**
 * Pageable iterator helper. Replaces `(__ITER % N) + 1` open-coded in
 * every test file.
 */
export function cyclePage(iter: number, span: number): number {
  if (span < 1) throw new Error("cyclePage span must be >= 1");
  const safeIter = Number.isFinite(iter) && iter >= 0 ? iter : 0;
  return (safeIter % span) + 1;
}
