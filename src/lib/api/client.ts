/**
 * The seam. Every piece of UI code depends on `ChatClient` and nothing else — never on `fetch`.
 * Swapping the mock for the real backend is one env var (see ./factory.ts).
 */
import type {
  ApiErrorBody,
  ChatRequest,
  ChatStreamEvent,
  DocumentsResponse,
  ErrorEvent,
  FeedbackRequest,
  HealthResponse,
} from "./schemas";

export type ClientMode = "mock" | "live";

export interface RequestOptions {
  signal?: AbortSignal;
}

export interface ChatClient {
  readonly mode: ClientMode;

  /**
   * Streams one assistant response.
   *
   * Error contract: this never rejects for server, transport, or contract failures. Those arrive as
   * a terminal `error` event so the UI keeps any partial text and has one code path for failure.
   * Aborting via `options.signal` ends iteration silently — the caller owns the signal and already
   * knows. Only programmer errors throw.
   */
  streamChat(request: ChatRequest, options?: RequestOptions): AsyncIterable<ChatStreamEvent>;

  /** Rejects with {@link ApiError}. */
  getHealth(options?: RequestOptions): Promise<HealthResponse>;

  /** Rejects with {@link ApiError}. */
  listDocuments(options?: RequestOptions): Promise<DocumentsResponse>;

  /** Optional backend endpoint: resolves (does not throw) when the backend has not implemented it. */
  submitFeedback(feedback: FeedbackRequest, options?: RequestOptions): Promise<void>;
}

export class ApiError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly status: number | null;
  readonly body: ApiErrorBody | null;

  constructor(
    code: string,
    message: string,
    options: {
      retryable?: boolean;
      status?: number | null;
      body?: ApiErrorBody | null;
      cause?: unknown;
    } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "ApiError";
    this.code = code;
    this.retryable = options.retryable ?? isRetryableCode(code);
    this.status = options.status ?? null;
    this.body = options.body ?? null;
  }
}

const RETRYABLE_CODES: ReadonlySet<string> = new Set([
  "rate_limited",
  "service_unavailable",
  "internal_error",
  "upstream_unavailable",
  "vector_store_unavailable",
  "timeout",
  "network_error",
  "stream_interrupted",
  "http_error",
]);

export function isRetryableCode(code: string): boolean {
  return RETRYABLE_CODES.has(code);
}

export function makeErrorBody(
  code: string,
  message: string,
  extra: Partial<Omit<ApiErrorBody, "code" | "message">> = {},
): ApiErrorBody {
  return {
    code,
    message,
    retryable: extra.retryable ?? isRetryableCode(code),
    request_id: extra.request_id ?? null,
    retry_after_ms: extra.retry_after_ms ?? null,
    details: extra.details ?? null,
  };
}

export function makeErrorEvent(
  code: string,
  message: string,
  extra: Partial<Omit<ApiErrorBody, "code" | "message">> = {},
): ErrorEvent {
  return { type: "error", error: makeErrorBody(code, message, extra) };
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException === false
    ? error instanceof Error && error.name === "AbortError"
    : (error as DOMException).name === "AbortError";
}

/** Dev-only diagnostics. Production builds must stay console-clean. */
export function contractWarn(message: string, detail?: unknown): void {
  if (process.env.NODE_ENV === "production") return;
  if (detail === undefined) console.warn(`[contract] ${message}`);
  else console.warn(`[contract] ${message}`, detail);
}
