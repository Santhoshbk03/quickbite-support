/**
 * Demo resilience: wraps the live client and silently hands a request to the fixture-backed mock
 * when the backend cannot answer, while telling the UI it happened so the banner stays honest.
 *
 * Rules:
 * - Fall back only on failures *before* message.start. Once a live answer has begun, switching
 *   sources would splice two different answers together; that case surfaces as a retryable error.
 * - Never fall back on our own bad requests (4xx validation codes) — that would hide a real bug.
 * - After falling back, retry the live backend every minute, and immediately when /health recovers.
 */
import type { ChatClient, ClientMode, RequestOptions } from "./client";
import type {
  ChatRequest,
  ChatStreamEvent,
  DocumentsResponse,
  FeedbackRequest,
  HealthResponse,
} from "./schemas";

const CLIENT_BUG_CODES: ReadonlySet<string> = new Set([
  "invalid_request",
  "validation_error",
  "payload_too_large",
  "unsupported_media_type",
]);

const LIVE_RETRY_INTERVAL_MS = 60_000;

export class ResilientChatClient implements ChatClient {
  readonly mode: ClientMode;

  private readonly primary: ChatClient;
  private readonly createFallback: () => ChatClient;
  private fallbackClient: ChatClient | null = null;
  private fallbackActive = false;
  private retryLiveAt = 0;
  private readonly listeners = new Set<() => void>();

  constructor(primary: ChatClient, createFallback: () => ChatClient) {
    this.primary = primary;
    this.createFallback = createFallback;
    this.mode = primary.mode;
  }

  /** True while answers are coming from fixtures instead of the live backend. */
  get isFallbackActive(): boolean {
    return this.fallbackActive;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getFallbackSnapshot = (): boolean => this.fallbackActive;

  async *streamChat(
    request: ChatRequest,
    options: RequestOptions = {},
  ): AsyncGenerator<ChatStreamEvent, void, void> {
    if (this.fallbackActive && Date.now() < this.retryLiveAt) {
      yield* this.fallback().streamChat(request, options);
      return;
    }

    let started = false;
    for await (const event of this.primary.streamChat(request, options)) {
      if (!started && event.type === "error" && !CLIENT_BUG_CODES.has(event.error.code)) {
        this.setFallback(true);
        yield* this.fallback().streamChat(request, options);
        return;
      }
      if (event.type === "message.start") {
        started = true;
        this.setFallback(false);
      }
      yield event;
    }
  }

  async getHealth(options: RequestOptions = {}): Promise<HealthResponse> {
    try {
      const health = await this.primary.getHealth(options);
      this.setFallback(health.status === "down");
      return health;
    } catch (error) {
      if (!options.signal?.aborted) this.setFallback(true);
      throw error;
    }
  }

  async listDocuments(options: RequestOptions = {}): Promise<DocumentsResponse> {
    try {
      return await this.primary.listDocuments(options);
    } catch {
      return this.fallback().listDocuments(options);
    }
  }

  async submitFeedback(feedback: FeedbackRequest, options: RequestOptions = {}): Promise<void> {
    try {
      await this.primary.submitFeedback(feedback, options);
    } catch {
      // Feedback is always persisted locally; losing the server copy must not surface as an error.
    }
  }

  private fallback(): ChatClient {
    this.fallbackClient ??= this.createFallback();
    return this.fallbackClient;
  }

  private setFallback(active: boolean): void {
    if (active) this.retryLiveAt = Date.now() + LIVE_RETRY_INTERVAL_MS;
    if (this.fallbackActive === active) return;
    this.fallbackActive = active;
    this.listeners.forEach((listener) => listener());
  }
}
