#!/usr/bin/env bash
# stage-commits.sh — stage the v2-framework refactor as 10 logical commits.
#
# Two modes:
#
#   FRESH REPO (no .git yet):
#     bash scripts/stage-commits.sh
#   Creates a new repo on branch `main` with the 10 commits.
#
#   EXISTING REPO (typical — you cloned the v1 from GitHub):
#     bash scripts/stage-commits.sh
#   Detects .git, creates `refactor/v2-framework` off current HEAD,
#   and commits the refactor on top. Your old history on main is preserved
#   so reviewers can compare v1 → v2.
#
#   Override branch name:
#     BRANCH=my-branch bash scripts/stage-commits.sh

set -euo pipefail

BRANCH="${BRANCH:-refactor/v2-framework}"

if [[ -d .git ]]; then
  echo "→ existing repo detected — committing on top of current history"
  # sanity: make sure we aren't on an unborn branch
  git rev-parse HEAD >/dev/null 2>&1 || {
    echo "❌ repo has no commits yet. Either make an initial commit first, or delete .git and re-run for a fresh history."
    exit 1
  }
  # refuse if the target branch already exists — don't silently clobber
  if git show-ref --verify --quiet "refs/heads/${BRANCH}"; then
    echo "❌ branch '${BRANCH}' already exists. Delete it (git branch -D ${BRANCH}) or pass a different BRANCH=... and re-run."
    exit 1
  fi
  git checkout -qb "${BRANCH}"
  echo "→ on branch ${BRANCH}"
else
  echo "→ fresh repo — initialising"
  git init -q
  git checkout -qb main
  BRANCH=main
fi

git config user.email "${GIT_EMAIL:-$(git config user.email 2>/dev/null || echo rashmie.yuvaraj@arrive.com)}"
git config user.name  "${GIT_NAME:-$(git config user.name  2>/dev/null || echo Rashmie)}"

# ─────────────────────────────────────────────────────────────────────
# Commit 1 — tooling foundation
# ─────────────────────────────────────────────────────────────────────
git add .gitignore .eslintrc.json .prettierrc.json .env.example \
        tsconfig.json package.json utils/globals.d.ts reports/.gitkeep
git commit -q -m "chore(tooling): pin deps, add lint/prettier/strict tsconfig" -m "\
- TypeScript strict with noUnusedLocals/Parameters/ImplicitReturns
- ESLint + Prettier wired into npm ci:verify gate
- k6 ambient globals declared so strict lib:ES2020 still compiles
- .env.example documents every env var the suite consumes
- node_modules (dir + symlink) and refactored/ scratch folder ignored"

# ─────────────────────────────────────────────────────────────────────
# Commit 2 — env registry + SLA strategy
# ─────────────────────────────────────────────────────────────────────
git add config/environments.ts config/thresholds.ts
git commit -q -m "feat(config): env registry + SLA Strategy profiles" -m "\
Registry + Factory: one immutable REGISTRY keyed by EnvName. getEnv()
validates K6_ENV at init, fails closed if PROD_BASE_URL missing. Auth
token + retry budget + timeout live per-env so tests never hardcode.

Strategy pattern for thresholds: five named profiles (foundation,
steady_load, stress_breaking_point, soak_endurance, user_journey).
byEndpoint() helper centralises the tag-filter DSL so a typo in a tag
key can't silently disable a threshold."

# ─────────────────────────────────────────────────────────────────────
# Commit 3 — Fluent HTTP client
# ─────────────────────────────────────────────────────────────────────
git add utils/http-client.ts
git commit -q -m "feat(utils): Fluent HTTP client with retry, timeout, tagging, auth" -m "\
http_(env).endpoint(\"users_list\").timeout(\"5s\").get(url)

- Fluent Interface: reads like a sentence, forbids forgetting to tag
- Exponential backoff with jitter (100ms → 200ms → 400ms, ±25%)
- Retry-statuses configurable per-call (default: 0,502,503,504)
- Auth header injected transparently from env config
- Emits perf_retry_attempts{endpoint:...} so dashboards see retry storms
- Throws on empty endpoint names and non-serialisable bodies"

# ─────────────────────────────────────────────────────────────────────
# Commit 4 — SharedArray data factory + telemetry registry
# ─────────────────────────────────────────────────────────────────────
git add utils/data-factory.ts utils/metrics.ts
git commit -q -m "feat(utils): SharedArray data factory + init-context telemetry registry" -m "\
Data factory:
- SharedArray materialises seed pool once in main isolate; VUs read a
  read-only view. Matters at 200+ VUs where per-VU re-allocation
  inflates memory.
- nextPost(iter) deterministic rotation instead of random → reproducible
- Replaces Math.floor(Math.random()*10)+1 inlined across 5 test files

Metrics:
- Eager module-top-level allocation of Trend/Counter/Rate. k6 requires
  custom metrics to be declared in the init context — lazy allocation
  inside the VU loop throws \"metrics must be declared in the init context\"
- KNOWN_FLOWS pre-declares every stage Trend for the user journey, so
  asking for an unknown flow fails fast at init rather than silently
  dropping samples"

# ─────────────────────────────────────────────────────────────────────
# Commit 5 — handleSummary + helpers
# ─────────────────────────────────────────────────────────────────────
git add utils/summary.ts utils/helpers.ts
git commit -q -m "feat(utils): handleSummary with stdout + JSON + JUnit XML sinks" -m "\
- stdout: textSummary for live CI console
- reports/summary.json: machine-readable for downstream tooling
- reports/junit.xml: renders in GitHub Actions' native test UI, no dep

helpers.ts tightened:
- thinkTime validates its range (throws on inverted/negative)
- assertOk(res, label, expectedStatus, budgetMs) is the one-liner every
  test uses — status + latency budget + body-non-empty, all tagged, all
  feeding perf_latency_ms + perf_iteration_success"

# ─────────────────────────────────────────────────────────────────────
# Commit 6 — test refactor (foundations/load/stress/soak)
# ─────────────────────────────────────────────────────────────────────
git add tests/foundations tests/load tests/stress tests/soak
git commit -q -m "refactor(tests): port foundations/load/stress/soak to new framework" -m "\
Every test reduced to intent — 40–60 lines of composition. No hardcoded
URLs. No inline headers. No duplicated check-strings.

Key correction — stress test executor:
- v1 used ramping-vus. As the target slows, request rate drops, hiding
  server-side saturation.
- v2 uses ramping-arrival-rate with preAllocatedVUs:50 maxVUs:400 so
  pressure stays constant as the target degrades.
- Retries disabled explicitly in stress — don't mask breakage with retries

Soak: elapsedBucket() tag per request so drift shows up time-bucketed in
Grafana. setup()/teardown() now thread timestamps through instead of
just log lines."

# ─────────────────────────────────────────────────────────────────────
# Commit 7 — real user journey
# ─────────────────────────────────────────────────────────────────────
git add tests/scenarios
git commit -q -m "feat(scenarios): ecommerce journey with per-endpoint SLAs (replaces broken sauce-demo)" -m "\
The v1 sauce-demo.ts targeted www.saucedemo.com's /inventory.html,
/cart.html, /checkout-step-one.html — all 404. Saucedemo is a React SPA
and those paths are client-side routes, not server files. v1 measured
nothing.

v2:
- New ecommerce-journey.ts maps login → inventory → cart → checkout
  onto stable jsonplaceholder endpoints (/users/{id}, /users/{id}/posts,
  /users/{id}/todos, POST /posts)
- Per-step Trend + per-endpoint SLA
- Content-presence check on every response (catches 200s with wrong body)
- business-error counter wired into checkout failure path
- sauce-demo.ts kept as a thin re-export stub for backward compatibility"

# ─────────────────────────────────────────────────────────────────────
# Commit 8 — CI pipeline
# ─────────────────────────────────────────────────────────────────────
git add .github
git commit -q -m "ci: 5-stage pipeline with SAST, parallel matrix, PR summary" -m "\
Stage 1 static:     ESLint + Prettier + tsc + Gitleaks (secret scan)
Stage 2 security:   Trivy FS (vuln,secret,misconfig) → SARIF code-scanning
Stage 3 perf:       foundations · load · stress · scenarios in parallel
                    Stress = informational (no gate); others gate
Stage 4 PR comment: markdown table with p95 / err / checks per suite
Stage 5 soak:       decoupled; main branch or workflow_dispatch only

Hardening:
- k6 install: version-pinned tarball (replaces deprecated apt-key)
- Third-party actions pinned to commit SHAs (supply-chain hygiene)
- concurrency: perf-\${ref} + cancel-in-progress saves CI minutes
- Least-privilege permissions block
- workflow_dispatch inputs for env + suite selection
- JUnit → GitHub native test checks UI"

# ─────────────────────────────────────────────────────────────────────
# Commit 9 — hardened compose + grafana
# ─────────────────────────────────────────────────────────────────────
git add docker-compose.yml grafana
git commit -q -m "chore(compose): harden Influx + Grafana stack" -m "\
- Pin image versions (influxdb:1.8.10-alpine, grafana:11.1.3)
- Bind to loopback (127.0.0.1) — no 0.0.0.0 exposure
- Credentials required — anonymous Admin removed
- Healthchecks, resource caps, unless-stopped restart policy
- Isolated bridge network
- Grafana provisioning: folder-based dashboard discovery, editable=false

InfluxDB 1.8 is EOL but pinned for compatibility with k6 v0.54's
influxdb output plugin. Migration to v2 is follow-up work — see
AUDIT-REPORT.md."

# ─────────────────────────────────────────────────────────────────────
# Commit 10 — docs
# ─────────────────────────────────────────────────────────────────────
git add README.md AUDIT-REPORT.md docs
git commit -q -m "docs: refreshed README + full audit report" -m "\
README rewritten to reflect v2 architecture — env registry, fluent
client, SLA profiles, 5-stage CI.

AUDIT-REPORT.md captures:
- Senior-level rating (scripting vs architect)
- AI-smell patterns in v1 (dead scaffolding, boilerplate, generic naming)
- Clean-sweep gap analysis with before→after table
- Rationale for every pattern in v2
- Next-day backlog (dashboards as code, baseline regression, chaos, IaC)"

# ─────────────────────────────────────────────────────────────────────
# Verify
# ─────────────────────────────────────────────────────────────────────
echo ""
echo "─── last 10 commits on ${BRANCH} ───"
git log --oneline -n 10

echo ""
echo "─── verify nothing untracked ───"
if [[ -n "$(git status --porcelain)" ]]; then
  echo "⚠ untracked files remain:"
  git status --short
else
  echo "✓ clean working tree"
fi

echo ""
echo "Next steps:"
echo "  # push the new branch; opens a clean diff for PR review"
echo "  git push -u origin ${BRANCH}"
echo ""
echo "  # then on GitHub, open a PR:  ${BRANCH}  →  main"
