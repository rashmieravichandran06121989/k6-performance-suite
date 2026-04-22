# k6-performance-suite

![k6 Performance Tests](https://github.com/rashmieravichandran06121989/k6-performance-suite/actions/workflows/performance.yml/badge.svg)

> Last run: p(95) 103ms @ 10 VUs — jsonplaceholder.typicode.com — Apr 2026


```bash
k6 run tests/load/load-test.ts
```

Performance testing suite built with k6 and TypeScript. Covers load, stress, soak, and multi-step real-user scenarios. Thresholds wired into GitHub Actions so the pipeline fails automatically on SLA breach.

---

## Prerequisites

Tests run against [reqres.in](https://reqres.in) by default — no auth needed.

```bash
# macOS
brew install k6

# Windows
choco install k6

# Linux (Debian/Ubuntu)
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# install TS types
npm install
```

---

## Running Tests

### Foundations
```bash
k6 run tests/foundations/foundations-test.ts
```
10 VUs, 30s. Good starting point to verify install and check baseline response times.
![foundations run](docs/foundations-run.png)

### Load Test
```bash
k6 run tests/load/load-test.ts
```
Ramps to 20 VUs, holds at 50 for 3m, ramps down. Mimics normal production traffic.

### Stress Test
```bash
k6 run tests/stress/stress-test.ts
```
50 → 100 → 150 → 200 VUs, 2-3m per step, then recovery. Errors start appearing around 150 VUs on reqres — that's expected, that's the point.

### Soak Test
```bash
k6 run tests/soak/soak-test.ts
```
30 VUs for 30 minutes. Run overnight or as a blocking CI step on main only. If `soak_response_time_ms` p(95) starts climbing after the 15m mark, there's a connection leak.

### Real Scenario — Sauce Demo
```bash
k6 run tests/scenarios/sauce-demo.ts
```
100 concurrent users through login → inventory → cart → checkout. Per-flow latency tracked via custom `Trend` metrics.

---

## Grafana Dashboard

Start the stack:
```bash
docker-compose up -d
```

Stream results into InfluxDB during a run:
```bash
k6 run --out influxdb=http://localhost:8086/k6 tests/load/load-test.ts
```

Import dashboard ID `2587` in Grafana at `http://localhost:3000`. Shows p95, RPS, and error rate live.

Screenshots in `/docs` once wired up — TODO.

---

## Exporting Results

I use JSON locally and InfluxDB in CI:

```bash
# local
k6 run --out json=reports/results.json tests/load/load-test.ts

# CI
k6 run --out influxdb=http://localhost:8086/k6 tests/load/load-test.ts
```

---

## Global Thresholds

These are hard stops — breach any and the pipeline fails:

| Metric | Threshold |
|--------|-----------|
| `http_req_duration` | `p(95) < 500ms` |
| `http_req_failed` | `rate < 1%` |
| `checks` | `rate >= 95%` |

---

## CI / CD

GitHub Actions runs the load test on every push to main and every PR. Pipeline fails automatically if thresholds are breached — no manual check needed.

Workflow: `.github/workflows/performance.yml`

---

## Project Structure

```
k6-performance-suite/
├── .github/workflows/
│   └── performance.yml      # SLA gate on push/PR
├── config/
│   └── environments.ts      # base URLs, thresholds, shared headers
├── utils/
│   └── helpers.ts           # shared helpers
├── tests/
│   ├── foundations/         # Day 1 — 10 VUs / 30s
│   ├── load/                # Day 2 — 50 VUs / 5 min
│   ├── stress/              # Day 2 — 0→200 VUs
│   ├── soak/                # Day 2 — 30 VUs / 30 min
│   └── scenarios/           # Day 5 — real multi-step flows
├── docs/                    # screenshots and result exports
├── reports/                 # local JSON/HTML output (gitignored)
├── docker-compose.yml       # InfluxDB + Grafana stack
├── tsconfig.json
└── package.json
```
# last updated Apr 2026
