/**
 * handleSummary — emits three parallel artefacts:
 *   1. stdout: compact textSummary for live CI console
 *   2. reports/summary.json: machine-readable for downstream tooling
 *   3. reports/junit.xml: so the same run surfaces in any CI's native
 *      test-results UI (GitHub Actions, GitLab, Jenkins, CircleCI).
 *
 * k6's stdlib has `textSummary`; JUnit we render ourselves because the
 * `k6-reporter` package is optional and we don't want a hard dep.
 */

import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.2/index.js";

type Summary = {
  metrics: Record<string, MetricSummary>;
  root_group?: unknown;
  options?: unknown;
};

type MetricSummary = {
  type: string;
  contains?: string;
  values: Record<string, number>;
  thresholds?: Record<string, { ok: boolean }>;
};

export function handleSummary(data: Summary): Record<string, string> {
  const text = textSummary(data, { indent: "  ", enableColors: false });

  return {
    stdout: text,
    "reports/summary.json": JSON.stringify(data, null, 2),
    "reports/junit.xml": toJUnit(data),
  };
}

function toJUnit(data: Summary): string {
  const metrics = data.metrics ?? {};
  const cases: string[] = [];
  let failures = 0;

  for (const [metric, summary] of Object.entries(metrics)) {
    const thresholds = summary.thresholds;
    if (!thresholds) continue;

    for (const [expr, result] of Object.entries(thresholds)) {
      const ok = result.ok;
      if (!ok) failures += 1;

      const title = escapeXml(`${metric} ${expr}`);
      if (ok) {
        cases.push(`    <testcase name="${title}" classname="k6.threshold" />`);
      } else {
        cases.push(
          `    <testcase name="${title}" classname="k6.threshold">\n` +
            `      <failure message="threshold breached">metric=${escapeXml(metric)} expr=${escapeXml(
              expr,
            )}</failure>\n` +
            `    </testcase>`,
        );
      }
    }
  }

  const total = cases.length;
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<testsuite name="k6-thresholds" tests="${total}" failures="${failures}">\n` +
    `${cases.join("\n")}\n` +
    `</testsuite>\n`
  );
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
