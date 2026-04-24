/**
 * Fluent HTTP client with defensive retries, per-endpoint tagging,
 * and uniform auth injection.
 *
 * Usage:
 *   http(env)
 *     .endpoint("list_users")
 *     .timeout("5s")
 *     .get(`${env.baseUrl}/users`);
 *
 *   http(env)
 *     .endpoint("create_post")
 *     .retryOn([502, 503, 504])
 *     .post(`${env.baseUrl}/posts`, { title: "x" });
 *
 * Why fluent rather than a params bag:
 *   - Call sites read like a sentence (self-documenting).
 *   - Every knob is explicit; defaults are safe.
 *   - Forbids the common mistake of forgetting to tag metrics.
 */

import http, { RefinedParams, RefinedResponse, ResponseType } from "k6/http";
import { sleep } from "k6";
import { EnvConfig } from "../config/environments.ts";
import { telemetry } from "./metrics.ts";

type Body = string | Record<string, unknown> | null;

const DEFAULT_RETRY_STATUSES = [0, 502, 503, 504];

export class HttpRequestBuilder {
  private _endpoint = "unknown";
  private _timeout?: string;
  private _extraHeaders: Record<string, string> = {};
  private _extraTags: Record<string, string> = {};
  private _retryStatuses = [...DEFAULT_RETRY_STATUSES];
  private _maxAttempts: number;

  constructor(private readonly env: EnvConfig) {
    this._maxAttempts = env.maxAttempts;
  }

  /** Logical name of the endpoint — used for metric tagging. Required. */
  endpoint(name: string): this {
    if (!name) throw new Error("endpoint() requires a non-empty name");
    this._endpoint = name;
    return this;
  }

  timeout(t: string): this {
    this._timeout = t;
    return this;
  }

  header(key: string, value: string): this {
    this._extraHeaders[key] = value;
    return this;
  }

  tag(key: string, value: string): this {
    this._extraTags[key] = value;
    return this;
  }

  retryOn(statuses: number[]): this {
    this._retryStatuses = statuses.slice();
    return this;
  }

  maxAttempts(n: number): this {
    if (n < 1) throw new Error("maxAttempts must be >= 1");
    this._maxAttempts = n;
    return this;
  }

  get(url: string): RefinedResponse<ResponseType | undefined> {
    return this._dispatch("GET", url, null);
  }

  post(url: string, body: Body): RefinedResponse<ResponseType | undefined> {
    return this._dispatch("POST", url, body);
  }

  put(url: string, body: Body): RefinedResponse<ResponseType | undefined> {
    return this._dispatch("PUT", url, body);
  }

  patch(url: string, body: Body): RefinedResponse<ResponseType | undefined> {
    return this._dispatch("PATCH", url, body);
  }

  del(url: string): RefinedResponse<ResponseType | undefined> {
    return this._dispatch("DELETE", url, null);
  }

  // ---- private ---------------------------------------------------------

  private _dispatch(
    method: string,
    url: string,
    body: Body,
  ): RefinedResponse<ResponseType | undefined> {
    const params = this._buildParams();
    const payload = this._serialise(body);
    const { retries } = telemetry();

    let last: RefinedResponse<ResponseType | undefined> | undefined;
    let attempt = 0;

    while (attempt < this._maxAttempts) {
      attempt += 1;
      last = http.request(method, url, payload as string | null, params);

      if (!this._shouldRetry(last.status)) return last;
      if (attempt >= this._maxAttempts) return last;

      retries.add(1, { endpoint: this._endpoint });
      sleep(this._backoff(attempt));
    }

    // Type system: the loop always returns; satisfies non-null return.
    return last as RefinedResponse<ResponseType | undefined>;
  }

  private _buildParams(): RefinedParams<ResponseType | undefined> {
    const headers: Record<string, string> = {
      ...this.env.defaultHeaders,
      ...this._extraHeaders,
    };
    if (this.env.authToken) headers["Authorization"] = `Bearer ${this.env.authToken}`;

    return {
      headers,
      timeout: this._timeout ?? this.env.requestTimeout,
      tags: {
        ...this.env.tags,
        ...this._extraTags,
        endpoint: this._endpoint,
      },
    };
  }

  private _serialise(body: Body): string | null {
    if (body == null) return null;
    if (typeof body === "string") return body;
    try {
      return JSON.stringify(body);
    } catch (err) {
      throw new Error(`HttpRequestBuilder: body not serialisable (${String(err)})`);
    }
  }

  private _shouldRetry(status: number): boolean {
    return this._retryStatuses.indexOf(status) !== -1;
  }

  /** Exponential backoff with jitter — 100ms → 200ms → 400ms, jittered ±25%. */
  private _backoff(attempt: number): number {
    const base = 0.1 * Math.pow(2, attempt - 1);
    const jitter = base * 0.25 * (Math.random() * 2 - 1);
    return Math.max(0.05, base + jitter);
  }
}

export function http_(env: EnvConfig): HttpRequestBuilder {
  return new HttpRequestBuilder(env);
}
