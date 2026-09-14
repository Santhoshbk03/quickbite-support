/**
 * The mock ChatClient: a first-class product feature, not a dev stub.
 *
 * It is the client the public demo runs on, so it has to be convincing: real retrieval behaviour,
 * real refusals, tool calls mid-stream, variable latency, and an injectable failure mode so every
 * error state in the UI can be seen on demand.
 */
import { ApiError, contractWarn, makeErrorEvent } from "../client";
import type { ChatClient, ClientMode, RequestOptions } from "../client";
import type { MockProfile } from "../config";
import {
  ChatRequestSchema,
  CONTRACT_VERSION,
  FeedbackRequestSchema,
  parseStreamEvent,
  summarizeIssues,
} from "../schemas";
import type {
  ChatRequest,
  ChatStreamEvent,
  DocumentsResponse,
  FeedbackRequest,
  HealthResponse,
  HealthStatus,
} from "../schemas";
import { KNOWLEDGE_CHUNKS, KNOWLEDGE_DOCUMENTS, POLICY_DOCUMENTS } from "@/lib/fixtures";
import { planResponse } from "./engine";
import { playResponse } from "./player";
import { PIPELINE, sleepFor, TIMING_PROFILES } from "./profiles";
import type { TimingProfile } from "./profiles";
import { createRandom, hashSeed } from "./random";

export type MockFailureMode =
  | "none"
  /** fetch itself rejects: offline, DNS, CORS, connection refused. Triggers the replay fallback. */
  | "network"
  /** HTTP 500 with a valid error envelope. */
  | "http_500"
  /** HTTP 429 with retry_after_ms. */
  | "rate_limited"
  /** No response headers within the client's budget. */
  | "timeout"
  /** Groq and the Ollama fallback both fail, after retrieval. */
  | "upstream_unavailable"
  /** Connection drops part-way through the answer; partial text must survive. */
  | "mid_stream"
  /** An event that fails schema validation, as HttpChatClient would report it. */
  | "contract_violation";

export interface MockFailureConfig {
  mode: MockFailureMode;
  /** Probability per request, 0–1. Defaults to 1. */
  rate?: number;
  /** Fail once, then recover. Useful for demonstrating retry. */
  once?: boolean;
}

export interface MockChatClientOptions {
  profile?: MockProfile;
  failure?: MockFailureConfig | MockFailureMode;
  /** Override the profile's cold-start behaviour. */
  coldStart?: boolean;
  /** Fix the seed to make a run byte-for-byte reproducible. */
  seed?: number;
  now?: () => Date;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  /** What GET /health reports. */
  health?: HealthStatus;
}

const MID_STREAM_CUT_FRACTION = 0.4;

export class MockChatClient implements ChatClient {
  readonly mode: ClientMode = "mock";

  private profileName: MockProfile;
  private timing: TimingProfile;
  private failure: MockFailureConfig;
  private coldStartPending: boolean;
  private seed: number | null;
  private healthStatus: HealthStatus;
  private readonly nowFn: () => Date;
  private readonly sleepFn: (ms: number, signal?: AbortSignal) => Promise<void>;

  constructor(options: MockChatClientOptions = {}) {
    this.profileName = options.profile ?? "demo";
    this.timing = TIMING_PROFILES[this.profileName];
    this.failure = normalizeFailure(options.failure);
    this.coldStartPending = options.coldStart ?? this.timing.coldStart !== null;
    this.seed = options.seed ?? null;
    this.healthStatus = options.health ?? "ok";
    this.nowFn = options.now ?? (() => new Date());
    this.sleepFn = options.sleep ?? sleepFor;
  }

  /** Adjust behaviour at runtime, e.g. from a dev toolbar or a URL parameter. */
  configure(patch: MockChatClientOptions): void {
    if (patch.profile) {
      this.profileName = patch.profile;
      this.timing = TIMING_PROFILES[patch.profile];
    }
    if (patch.failure !== undefined) this.failure = normalizeFailure(patch.failure);
    if (patch.coldStart !== undefined) this.coldStartPending = patch.coldStart;
    if (patch.seed !== undefined) this.seed = patch.seed;
    if (patch.health !== undefined) this.healthStatus = patch.health;
  }

  get profile(): MockProfile {
    return this.profileName;
  }

  async *streamChat(
    request: ChatRequest,
    options: RequestOptions = {},
  ): AsyncGenerator<ChatStreamEvent, void, void> {
    const validated = ChatRequestSchema.safeParse(request);
    if (!validated.success) {
      contractWarn("Outgoing /chat request failed validation", validated.error.issues);
      yield makeErrorEvent(
        "invalid_request",
        `The request did not match the contract: ${summarizeIssues(validated.error)}`,
        { retryable: false },
      );
      return;
    }

    const rng = createRandom(
      this.seed ??
        hashSeed(`${request.conversation_id}:${request.message.id}:${request.message.content}`),
    );
    const now = this.nowFn();
    const failureMode = this.nextFailureMode(rng);
    const sleep = (ms: number) => this.sleepFn(ms * this.timing.sleepScale, options.signal);

    const leadIn =
      rng.range(this.timing.rtt) +
      (this.coldStartPending && this.timing.coldStart ? rng.range(this.timing.coldStart) : 0);
    this.coldStartPending = false;

    try {
      // Failures that happen before any event reaches the client.
      if (failureMode === "network") {
        await sleep(rng.range(this.timing.rtt) * 2);
        yield makeErrorEvent(
          "network_error",
          "Could not reach the backend (TypeError: Failed to fetch).",
        );
        return;
      }
      if (failureMode === "http_500") {
        await sleep(leadIn);
        yield makeErrorEvent("internal_error", "The backend returned HTTP 500.", {
          request_id: `req_${rng.hex(8)}`,
        });
        return;
      }
      if (failureMode === "rate_limited") {
        await sleep(leadIn);
        yield makeErrorEvent("rate_limited", "Too many requests. Please try again in a moment.", {
          retry_after_ms: 20_000,
          request_id: `req_${rng.hex(8)}`,
        });
        return;
      }
      if (failureMode === "timeout") {
        // Long enough for the UI to show its waking-up state before giving up.
        await sleep(20_000);
        yield makeErrorEvent(
          "timeout",
          "The backend did not respond in time. It may be waking up from sleep.",
        );
        return;
      }

      const plan = planResponse(validated.data, { now, rng, profile: this.timing });
      const messageId = `msg_${rng.hex(12)}`;

      if (failureMode === "contract_violation") {
        await sleep(leadIn);
        yield {
          type: "message.start",
          message_id: messageId,
          conversation_id: request.conversation_id,
          created_at: now.toISOString(),
        };
        yield makeErrorEvent(
          "contract_violation",
          'Event "retrieval" failed validation — retrieval.chunks.0.distance: Invalid input: expected number, received string',
        );
        return;
      }

      const stream = playResponse({
        plan,
        conversationId: request.conversation_id,
        messageId,
        now,
        rng,
        profile: this.timing,
        leadInMs: leadIn,
        sleep: this.sleepFn,
        signal: options.signal,
      });

      let deltaCount = 0;
      const expectedDeltas = Math.max(1, Math.round(plan.content.length / 18));
      const cutAfter = Math.max(1, Math.round(expectedDeltas * MID_STREAM_CUT_FRACTION));

      for await (const event of stream) {
        // The mock validates its own output, so it can never drift from the published contract.
        if (process.env.NODE_ENV !== "production") {
          const parsed = parseStreamEvent(event);
          if (parsed.kind === "invalid") {
            contractWarn(`Mock emitted an invalid ${parsed.type} event — ${parsed.issues}`);
          }
        }

        if (
          failureMode === "upstream_unavailable" &&
          event.type === "status" &&
          event.phase === "generating"
        ) {
          yield makeErrorEvent(
            "upstream_unavailable",
            "Groq is rate-limiting and the Ollama fallback did not respond.",
            { request_id: `req_${rng.hex(8)}` },
          );
          return;
        }

        yield event;

        if (event.type === "message.delta") {
          deltaCount += 1;
          if (failureMode === "mid_stream" && deltaCount >= cutAfter) {
            yield makeErrorEvent(
              "stream_interrupted",
              "The connection closed before the response finished.",
            );
            return;
          }
        }
      }
    } catch (error) {
      // The only expected rejection is the caller aborting (stop button); the caller knows already.
      if (options.signal?.aborted) return;
      throw error;
    }
  }

  async getHealth(options: RequestOptions = {}): Promise<HealthResponse> {
    const rng = createRandom(this.seed ?? hashSeed(`health:${Math.floor(Date.now() / 30_000)}`));
    if (this.failure.mode === "network") {
      await this.sleepFn(rng.range(this.timing.rtt) * this.timing.sleepScale, options.signal);
      throw new ApiError(
        "network_error",
        "Could not reach the backend (TypeError: Failed to fetch).",
      );
    }
    await this.sleepFn(
      rng.range(this.timing.healthLatency) * this.timing.sleepScale,
      options.signal,
    );

    const primaryAvailable = this.healthStatus === "ok";
    return {
      status: this.healthStatus,
      checked_at: this.nowFn().toISOString(),
      contract_version: CONTRACT_VERSION,
      version: "0.0.0-mock",
      uptime_s: 0,
      models: {
        primary: {
          provider: PIPELINE.primaryModel.provider,
          name: PIPELINE.primaryModel.name,
          available: primaryAvailable,
          latency_ms: primaryAvailable ? round(rng.float(180, 420), 0) : null,
        },
        fallback: {
          provider: PIPELINE.fallbackModel.provider,
          name: PIPELINE.fallbackModel.name,
          available: this.healthStatus !== "down",
          latency_ms: null,
        },
      },
      vector_store: {
        provider: "chromadb",
        available: this.healthStatus !== "down",
        document_count: POLICY_DOCUMENTS.length,
        chunk_count: KNOWLEDGE_CHUNKS.length,
        collection: PIPELINE.collection,
      },
      embeddings: {
        model: PIPELINE.embeddingModel,
        dimensions: PIPELINE.embeddingDimensions,
      },
      langfuse_enabled: true,
    };
  }

  async listDocuments(options: RequestOptions = {}): Promise<DocumentsResponse> {
    const rng = createRandom(this.seed ?? hashSeed("documents"));
    await this.sleepFn(
      rng.range(this.timing.healthLatency) * this.timing.sleepScale,
      options.signal,
    );
    return { documents: [...KNOWLEDGE_DOCUMENTS], total: KNOWLEDGE_DOCUMENTS.length };
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
    // Thumbs are stored locally by the UI; this is a no-op that keeps the interface honest.
    await this.sleepFn(40 * this.timing.sleepScale, options.signal);
  }

  private nextFailureMode(rng: ReturnType<typeof createRandom>): MockFailureMode {
    if (this.failure.mode === "none") return "none";
    const rate = this.failure.rate ?? 1;
    if (rate < 1 && !rng.chance(rate)) return "none";
    const mode = this.failure.mode;
    if (this.failure.once) this.failure = { mode: "none" };
    return mode;
  }
}

function normalizeFailure(failure: MockChatClientOptions["failure"]): MockFailureConfig {
  if (failure === undefined) return { mode: "none" };
  return typeof failure === "string" ? { mode: failure } : failure;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

const FAILURE_MODES: readonly MockFailureMode[] = [
  "none",
  "network",
  "http_500",
  "rate_limited",
  "timeout",
  "upstream_unavailable",
  "mid_stream",
  "contract_violation",
];

const MOCK_PROFILES: readonly MockProfile[] = ["demo", "realistic", "instant"];

/**
 * Read mock controls from the URL, so any error state can be demonstrated with a link:
 * `?mock_failure=mid_stream`, `?mock_profile=realistic&mock_cold_start=1`.
 */
export function parseMockOptionsFromSearch(params: URLSearchParams): MockChatClientOptions {
  const options: MockChatClientOptions = {};

  const profile = params.get("mock_profile");
  if (profile && (MOCK_PROFILES as readonly string[]).includes(profile)) {
    options.profile = profile as MockProfile;
  }

  const failure = params.get("mock_failure");
  if (failure && (FAILURE_MODES as readonly string[]).includes(failure)) {
    const rate = Number(params.get("mock_failure_rate"));
    options.failure = {
      mode: failure as MockFailureMode,
      rate: Number.isFinite(rate) && rate > 0 && rate <= 1 ? rate : 1,
      once: params.get("mock_failure_once") === "1",
    };
  }

  const coldStart = params.get("mock_cold_start");
  if (coldStart === "1" || coldStart === "0") options.coldStart = coldStart === "1";

  const seed = Number(params.get("mock_seed"));
  if (Number.isFinite(seed) && seed !== 0) options.seed = seed;

  const health = params.get("mock_health");
  if (health === "ok" || health === "degraded" || health === "down") options.health = health;

  return options;
}
