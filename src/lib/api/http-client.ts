/**
 * Live backend client.
 *
 * ┌─ READ THIS BEFORE GOING LIVE ─────────────────────────────────────────────────────────────┐
 * │ This is written against API_CONTRACT.md and verified against the reference SSE server      │
 * │ (`pnpm contract:serve`), not against the real backend. Every place where your              │
 * │ implementation could legitimately differ is marked TODO(integration). Work through         │
 * │ docs/INTEGRATION.md, run `pnpm contract:check --url <your-backend>`, and delete the        │
 * │ markers as you confirm them.                                                               │
 * └───────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Nothing else in the app knows this file exists; the UI depends on the ChatClient interface.
 */
import { ApiError, contractWarn, makeErrorBody, makeErrorEvent } from "./client";
import type { ChatClient, ClientMode, RequestOptions } from "./client";
import { joinUrl } from "./config";
import {
  ChatRequestSchema,
  CONTRACT_VERSION,
  DocumentsResponseSchema,
  ErrorEnvelopeSchema,
  FeedbackRequestSchema,
  HealthResponseSchema,
  parseStreamEvent,
  summarizeIssues,
} from "./schemas";
import type {
  ChatRequest,
  ChatStreamEvent,
  DocumentsResponse,
  FeedbackRequest,
  HealthResponse,
} from "./schemas";
import { decodeSseStream } from "./sse";
import type { z } from "zod";

export interface HttpChatClientOptions {
  /** Base URL, optionally including a path prefix. */
  baseUrl: string;
  /** Injectable for tests and for the contract checker. */
  fetchImpl?: typeof fetch;
  /**
   * How long to wait for /chat *response headers* before giving up. Generous on purpose: a
   * sleeping free-tier instance can take 30s+ to wake, and the replay fallback covers the wait.
   */
  headersTimeoutMs?: number;
  /** Timeout for the small JSON endpoints. */
  jsonTimeoutMs?: number;
  requestIdFactory?: () => string;
}

const DEFAULT_HEADERS_TIMEOUT_MS = 20_000;
const DEFAULT_JSON_TIMEOUT_MS = 5_000;

export class HttpChatClient implements ChatClient {
  readonly mode: ClientMode = "live";

  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly headersTimeoutMs: number;
  private readonly jsonTimeoutMs: number;
  private readonly requestIdFactory: () => string;
  private warnedAboutContractVersion = false;

  constructor(options: HttpChatClientOptions) {
    this.baseUrl = options.baseUrl;
    this.fetchImpl = options.fetchImpl ?? ((input, init) => globalThis.fetch(input, init));
    this.headersTimeoutMs = options.headersTimeoutMs ?? DEFAULT_HEADERS_TIMEOUT_MS;
    this.jsonTimeoutMs = options.jsonTimeoutMs ?? DEFAULT_JSON_TIMEOUT_MS;
    this.requestIdFactory = options.requestIdFactory ?? defaultRequestId;
  }

  async *streamChat(
    request: ChatRequest,
    options: RequestOptions = {},
  ): AsyncGenerator<ChatStreamEvent, void, void> {
    const validated = ChatRequestSchema.safeParse(request);
    if (!validated.success) {
      // A bug in our own UI, not a backend failure. Surface it loudly in dev.
      contractWarn("Outgoing /chat request failed validation", validated.error.issues);
      yield makeErrorEvent(
        "invalid_request",
        `The request did not match the contract: ${summarizeIssues(validated.error)}`,
        { retryable: false },
      );
      return;
    }

    const callerSignal = options.signal;
    if (callerSignal?.aborted) return;

    const controller = new AbortController();
    const onCallerAbort = () => controller.abort();
    callerSignal?.addEventListener("abort", onCallerAbort, { once: true });

    let headersTimedOut = false;
    let headersTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      headersTimedOut = true;
      controller.abort();
    }, this.headersTimeoutMs);
    const clearHeadersTimer = () => {
      if (headersTimer !== null) {
        clearTimeout(headersTimer);
        headersTimer = null;
      }
    };

    try {
      let response: Response;
      try {
        response = await this.fetchImpl(joinUrl(this.baseUrl, "/chat"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            "X-Request-Id": this.requestIdFactory(),
          },
          body: JSON.stringify(validated.data),
          signal: controller.signal,
          cache: "no-store",
        });
      } catch (error) {
        if (callerSignal?.aborted) return; // Stop button: the caller already knows.
        if (headersTimedOut) {
          yield makeErrorEvent(
            "timeout",
            "The backend did not respond in time. It may be waking up from sleep.",
          );
          return;
        }
        // fetch only rejects for transport-level problems: DNS, refused connection, CORS, offline.
        // This is the code that triggers the recorded-session fallback.
        yield makeErrorEvent("network_error", networkErrorMessage(error));
        return;
      } finally {
        clearHeadersTimer();
      }

      if (!response.ok) {
        yield await this.errorEventFromResponse(response);
        return;
      }

      // TODO(integration): confirm your host does not rewrite this header (some proxies strip the
      // charset, which is fine; a `application/json` here means the stream was buffered/transformed).
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("text/event-stream")) {
        yield makeErrorEvent(
          "contract_violation",
          `Expected text/event-stream, received "${contentType || "no content-type"}". If this is JSON, the response is being buffered by a proxy.`,
        );
        return;
      }
      if (!response.body) {
        yield makeErrorEvent("http_error", "The streaming response had no body.");
        return;
      }

      let sawTerminal = false;
      try {
        for await (const frame of decodeSseStream(response.body)) {
          if (frame.data === "") continue;

          let raw: unknown;
          try {
            raw = JSON.parse(frame.data);
          } catch {
            yield makeErrorEvent(
              "contract_violation",
              `Event data was not valid JSON: ${truncate(frame.data)}`,
            );
            return;
          }

          // TODO(integration): `data.type` is authoritative; the `event:` line is informational.
          // If they ever disagree in your implementation, fix the server rather than this branch.
          const parsed = parseStreamEvent(raw);
          if (parsed.kind === "unknown") {
            contractWarn(`Ignoring unknown event type "${parsed.type}"`);
            continue;
          }
          if (parsed.kind === "invalid") {
            yield makeErrorEvent(
              "contract_violation",
              `Event "${parsed.type}" failed validation — ${parsed.issues}`,
            );
            return;
          }

          yield parsed.event;
          if (parsed.event.type === "message.end" || parsed.event.type === "error") {
            sawTerminal = true;
            return;
          }
        }
      } catch (error) {
        if (callerSignal?.aborted) return;
        yield makeErrorEvent("stream_interrupted", networkErrorMessage(error));
        return;
      }

      if (!sawTerminal) {
        yield makeErrorEvent(
          "stream_interrupted",
          "The connection closed before the response finished.",
        );
      }
    } finally {
      clearHeadersTimer();
      callerSignal?.removeEventListener("abort", onCallerAbort);
    }
  }

  async getHealth(options: RequestOptions = {}): Promise<HealthResponse> {
    // 503 is a valid, meaningful health response ("down"), so it is not treated as a failure.
    const health = await this.fetchJson("/health", HealthResponseSchema, options, {
      acceptStatuses: [200, 503],
    });
    if (
      !this.warnedAboutContractVersion &&
      health.contract_version &&
      majorVersion(health.contract_version) !== majorVersion(CONTRACT_VERSION)
    ) {
      this.warnedAboutContractVersion = true;
      contractWarn(
        `Backend contract_version ${health.contract_version} does not match the frontend's ${CONTRACT_VERSION}.`,
      );
    }
    return health;
  }

  async listDocuments(options: RequestOptions = {}): Promise<DocumentsResponse> {
    return this.fetchJson("/documents", DocumentsResponseSchema, options);
  }

  async submitFeedback(feedback: FeedbackRequest, options: RequestOptions = {}): Promise<void> {
    const validated = FeedbackRequestSchema.safeParse(feedback);
    if (!validated.success) {
      throw new ApiError(
        "invalid_request",
        `Invalid feedback payload: ${summarizeIssues(validated.error)}`,
        { retryable: false },
      );
    }

    const response = await this.fetchRaw("/feedback", options, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validated.data),
    });

    // /feedback is P2. A backend that hasn't implemented it must not break the UI: thumbs are
    // persisted locally regardless.
    if (response.status === 404 || response.status === 405 || response.status === 501) {
      contractWarn(
        "POST /feedback is not implemented by the backend; keeping feedback local only.",
      );
      return;
    }
    if (!response.ok) {
      throw await this.apiErrorFromResponse(response);
    }
  }

  /* ---------------------------------------------------------------------------------------------
   * Internals
   * -------------------------------------------------------------------------------------------*/

  private async fetchRaw(
    path: string,
    options: RequestOptions,
    init: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const onCallerAbort = () => controller.abort();
    options.signal?.addEventListener("abort", onCallerAbort, { once: true });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.jsonTimeoutMs);

    try {
      return await this.fetchImpl(joinUrl(this.baseUrl, path), {
        ...init,
        headers: { Accept: "application/json", ...init.headers },
        signal: controller.signal,
        cache: "no-store",
      });
    } catch (error) {
      if (options.signal?.aborted) {
        throw new ApiError("cancelled", "The request was cancelled.", {
          retryable: false,
          cause: error,
        });
      }
      if (timedOut) {
        throw new ApiError("timeout", `${path} did not respond within ${this.jsonTimeoutMs}ms.`, {
          cause: error,
        });
      }
      throw new ApiError("network_error", networkErrorMessage(error), { cause: error });
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onCallerAbort);
    }
  }

  private async fetchJson<TSchema extends z.ZodType>(
    path: string,
    schema: TSchema,
    options: RequestOptions,
    config: { acceptStatuses?: number[] } = {},
  ): Promise<z.infer<TSchema>> {
    const response = await this.fetchRaw(path, options, { method: "GET" });
    const accepted = config.acceptStatuses ?? [200];
    if (!response.ok && !accepted.includes(response.status)) {
      throw await this.apiErrorFromResponse(response);
    }

    let raw: unknown;
    try {
      raw = await response.json();
    } catch (error) {
      throw new ApiError("http_error", `${path} did not return JSON.`, {
        status: response.status,
        cause: error,
      });
    }

    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      throw new ApiError(
        "contract_violation",
        `${path} response failed validation — ${summarizeIssues(parsed.error)}`,
        { status: response.status, retryable: false },
      );
    }
    return parsed.data;
  }

  private async errorEventFromResponse(response: Response): Promise<ChatStreamEvent> {
    const error = await this.apiErrorFromResponse(response);
    return {
      type: "error",
      error: error.body ?? makeErrorBody(error.code, error.message, { retryable: error.retryable }),
    };
  }

  private async apiErrorFromResponse(response: Response): Promise<ApiError> {
    const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
    let bodyText = "";
    try {
      bodyText = await response.text();
    } catch {
      // Ignore: an unreadable body still yields a useful status-based error.
    }

    if (bodyText) {
      try {
        const envelope = ErrorEnvelopeSchema.safeParse(JSON.parse(bodyText));
        if (envelope.success) {
          const body = envelope.data.error;
          return new ApiError(body.code, body.message, {
            retryable: body.retryable,
            status: response.status,
            body: { ...body, retry_after_ms: body.retry_after_ms ?? retryAfterMs },
          });
        }
      } catch {
        // Not JSON: fall through to a status-derived error (e.g. an nginx HTML 502 page).
      }
    }

    const code = statusToCode(response.status);
    return new ApiError(code, `The backend returned HTTP ${response.status}.`, {
      status: response.status,
      body: makeErrorBody(code, `The backend returned HTTP ${response.status}.`, {
        retry_after_ms: retryAfterMs,
      }),
    });
  }
}

/* -----------------------------------------------------------------------------------------------
 * Helpers
 * ---------------------------------------------------------------------------------------------*/

function statusToCode(status: number): string {
  if (status === 400) return "invalid_request";
  if (status === 413) return "payload_too_large";
  if (status === 415) return "unsupported_media_type";
  if (status === 422) return "validation_error";
  if (status === 429) return "rate_limited";
  if (status === 503) return "service_unavailable";
  if (status === 504) return "timeout";
  if (status >= 500) return "internal_error";
  return "http_error";
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, Math.round(seconds * 1000));
  const date = Date.parse(header);
  if (Number.isNaN(date)) return null;
  return Math.max(0, date - Date.now());
}

function networkErrorMessage(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return `Could not reach the backend (${detail}).`;
}

function truncate(value: string, max = 120): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

function majorVersion(version: string): string {
  return version.split(".")[0] ?? version;
}

function defaultRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `req_${globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  }
  return `req_${Math.random().toString(36).slice(2, 12)}`;
}
