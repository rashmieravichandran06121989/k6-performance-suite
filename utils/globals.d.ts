/**
 * k6 runtime ambient declarations.
 *
 * k6's JS runtime exposes a real `console` and supports fetching modules
 * from the k6 jslib CDN. TypeScript's DOM lib would pull in far more than
 * we want, so we narrow-declare exactly what we use.
 */

declare const console: {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
};

declare module "https://jslib.k6.io/k6-summary/0.0.2/index.js" {
  export function textSummary(
    data: unknown,
    options: { indent?: string; enableColors?: boolean },
  ): string;
}
