/**
 * QuickBite Support API contract, v1.
 *
 * Source of truth for docs/API_CONTRACT.md: every schema here maps to a section there, and field
 * names are snake_case to match the wire exactly (no mapping layer to drift).
 *
 * Leniency policy
 * - P0 fields are required. "Nullable P0" fields must be present but may be null.
 * - P1/P2 fields are `.nullish()`, so a backend that omits them still parses and the UI hides the
 *   dependent section.
 * - Unknown keys are stripped, so the backend may add fields without breaking the client.
 *
 * Keep this file erasable-syntax only (no enums, namespaces, parameter properties): the contract
 * scripts run it directly under Node's type stripping.
 */
import { z } from "zod";

export const CONTRACT_VERSION = "1.0.0";

export const MAX_MESSAGE_CHARS = 4000;
export const MAX_HISTORY_MESSAGES = 50;

/* -------------------------------------------------------------------------------------------------
 * Primitives
 * -----------------------------------------------------------------------------------------------*/

export const IdSchema = z.string().min(1).max(128);
export const DateTimeSchema = z.iso.datetime({ offset: true });
export const DateSchema = z.iso.date();
const Milliseconds = z.number().min(0);

export const MoneySchema = z.object({
  amount_minor: z.number().int(),
  currency: z.string().length(3),
});

export const DistanceMetricSchema = z.enum(["cosine", "l2", "ip"]);

/* -------------------------------------------------------------------------------------------------
 * §2 Retrieval & source chunks
 * -----------------------------------------------------------------------------------------------*/

export const SourceDocumentSchema = z.object({
  id: IdSchema,
  title: z.string().min(1),
  section: z.string().nullish(),
  category: z.string().nullish(),
  source_path: z.string().nullish(),
  version: z.string().nullish(),
  effective_date: DateSchema.nullish(),
});

export const SourceChunkSchema = z.object({
  id: IdSchema,
  rank: z.number().int().min(1),
  distance: z.number(),
  passed_threshold: z.boolean(),
  used_in_answer: z.boolean(),
  text: z.string().max(4000),
  document: SourceDocumentSchema,
  chunk_index: z.number().int().min(0).nullish(),
  token_count: z.number().int().min(0).nullish(),
});

export const RetrievalSchema = z.object({
  query: z.string(),
  standalone_query: z.string().nullish(),
  top_k: z.number().int().min(1),
  distance_metric: DistanceMetricSchema,
  threshold: z.number(),
  embedding_model: z.string().nullish(),
  collection: z.string().nullish(),
  chunks: z.array(SourceChunkSchema),
});

/* -------------------------------------------------------------------------------------------------
 * §3 Tool calls
 * -----------------------------------------------------------------------------------------------*/

export const OrderStatusSchema = z.enum([
  "placed",
  "confirmed",
  "preparing",
  "out_for_delivery",
  "delivered",
  "cancelled",
]);

export const TimelineStateSchema = z.enum(["complete", "current", "upcoming", "skipped"]);

export const OrderTimelineEventSchema = z.object({
  status: OrderStatusSchema,
  label: z.string().min(1),
  at: DateTimeSchema.nullable(),
  state: TimelineStateSchema,
  detail: z.string().nullish(),
});

export const OrderItemSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().int().min(1),
  unit_price: MoneySchema,
  modifiers: z.array(z.string()).nullish(),
});

export const LookupOrderArgumentsSchema = z.object({
  order_id: z.string().min(1),
});

export const LookupOrderResultSchema = z.object({
  order_id: z.string().min(1),
  status: OrderStatusSchema,
  placed_at: DateTimeSchema,
  restaurant: z.object({
    id: IdSchema,
    name: z.string().min(1),
    area: z.string().nullish(),
    cuisine: z.string().nullish(),
  }),
  items: z.array(OrderItemSchema).min(1),
  totals: z.object({
    subtotal: MoneySchema.nullish(),
    delivery_fee: MoneySchema.nullish(),
    taxes_and_fees: MoneySchema.nullish(),
    discount: MoneySchema.nullish(),
    tip: MoneySchema.nullish(),
    total: MoneySchema,
  }),
  eta: z
    .object({
      promised_by: DateTimeSchema.nullish(),
      estimated_at: DateTimeSchema.nullish(),
      minutes_remaining: z.number().int().nullish(),
      is_late: z.boolean(),
      minutes_late: z.number().int().min(0).nullish(),
    })
    .nullable(),
  delivered_at: DateTimeSchema.nullish(),
  timeline: z.array(OrderTimelineEventSchema).min(1),
  rider: z.object({ first_name: z.string().min(1), vehicle: z.string().nullish() }).nullish(),
  delivery_area: z.string().nullish(),
  payment_method: z.string().nullish(),
  cancellation: z
    .object({
      by: z.enum(["customer", "restaurant", "quickbite"]),
      reason: z.string().min(1),
      at: DateTimeSchema.nullish(),
    })
    .nullish(),
  refund: z
    .object({
      status: z.enum(["initiated", "processing", "completed"]),
      amount: MoneySchema,
      method: z.string().min(1),
      expected_by: DateTimeSchema.nullish(),
    })
    .nullish(),
});

export const ToolErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string(),
});

export const KNOWN_TOOL_NAMES = ["lookup_order"] as const;
export type KnownToolName = (typeof KNOWN_TOOL_NAMES)[number];

export function isKnownToolName(name: string): name is KnownToolName {
  return (KNOWN_TOOL_NAMES as readonly string[]).includes(name);
}

const toolCallBase = {
  id: IdSchema,
  status: z.enum(["success", "error"]),
  error: ToolErrorSchema.nullable(),
  duration_ms: Milliseconds.nullish(),
  content_offset: z.number().int().min(0).nullish(),
};

const statusMatchesPayload = {
  check: (call: { status: "success" | "error"; result?: unknown; error: unknown }) =>
    call.status === "success"
      ? call.result != null && call.error == null
      : call.error != null && call.result == null,
  params: {
    message:
      'status "success" requires result (and no error); "error" requires error (and no result)',
  },
};

export const LookupOrderToolCallSchema = z
  .object({
    ...toolCallBase,
    name: z.literal("lookup_order"),
    arguments: LookupOrderArgumentsSchema,
    result: LookupOrderResultSchema.nullable(),
  })
  .refine(statusMatchesPayload.check, statusMatchesPayload.params);

/** Any tool the client doesn't know. Rendered as a generic card with the raw payload. */
export const GenericToolCallSchema = z
  .object({
    ...toolCallBase,
    // Known tools must satisfy their typed schema; they may not fall through to the generic shape.
    name: z
      .string()
      .min(1)
      .refine((name) => !isKnownToolName(name), { message: "known tool failed its typed schema" }),
    arguments: z.record(z.string(), z.unknown()),
    result: z.unknown(),
  })
  .refine(statusMatchesPayload.check, statusMatchesPayload.params);

export const ToolCallSchema = z.union([LookupOrderToolCallSchema, GenericToolCallSchema]);

export const ToolCallStartSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  arguments: z.record(z.string(), z.unknown()),
  content_offset: z.number().int().min(0).nullish(),
});

/* -------------------------------------------------------------------------------------------------
 * §4 Refusals
 * -----------------------------------------------------------------------------------------------*/

export const BelowThresholdRefusalSchema = z.object({
  reason: z.literal("below_threshold"),
  message: z.string().min(1),
  threshold: z.number(),
  distance_metric: DistanceMetricSchema,
  closest_match: SourceChunkSchema.nullable(),
  suggestions: z.array(z.string().min(1)).nullish(),
});

export const PolicyRefusalSchema = z.object({
  reason: z.enum(["out_of_scope", "unsafe"]),
  message: z.string().min(1),
  suggestions: z.array(z.string().min(1)).nullish(),
});

export const RefusalSchema = z.discriminatedUnion("reason", [
  BelowThresholdRefusalSchema,
  PolicyRefusalSchema,
]);

/* -------------------------------------------------------------------------------------------------
 * §5 Errors
 * -----------------------------------------------------------------------------------------------*/

export const SERVER_ERROR_CODES = [
  "invalid_request",
  "validation_error",
  "payload_too_large",
  "unsupported_media_type",
  "rate_limited",
  "service_unavailable",
  "internal_error",
  "upstream_unavailable",
  "vector_store_unavailable",
  "timeout",
] as const;

/** Never sent by a server; synthesized by clients so the UI handles one closed set. */
export const CLIENT_ERROR_CODES = [
  "network_error",
  "http_error",
  "stream_interrupted",
  "contract_violation",
] as const;

export type ServerErrorCode = (typeof SERVER_ERROR_CODES)[number];
export type ClientErrorCode = (typeof CLIENT_ERROR_CODES)[number];
export type KnownErrorCode = ServerErrorCode | ClientErrorCode;

export const ApiErrorBodySchema = z.object({
  code: z.string().min(1),
  message: z.string(),
  retryable: z.boolean(),
  request_id: z.string().nullish(),
  retry_after_ms: z.number().int().min(0).nullish(),
  details: z.array(z.object({ path: z.string().nullish(), message: z.string() })).nullish(),
});

export const ErrorEnvelopeSchema = z.object({ error: ApiErrorBodySchema });

/* -------------------------------------------------------------------------------------------------
 * §6 Observability metadata
 * -----------------------------------------------------------------------------------------------*/

export const LatencyBreakdownSchema = z.object({
  total: Milliseconds,
  time_to_first_token: Milliseconds.nullish(),
  embedding: Milliseconds.nullish(),
  retrieval: Milliseconds.nullish(),
  filtering: Milliseconds.nullish(),
  tool_calls: Milliseconds.nullish(),
  generation: Milliseconds.nullish(),
});

export const SpanKindSchema = z.enum([
  "embedding",
  "retrieval",
  "filtering",
  "tool",
  "generation",
  "other",
]);

export const SpanSchema = z.object({
  name: z.string().min(1),
  kind: SpanKindSchema,
  start_ms: Milliseconds,
  duration_ms: Milliseconds,
});

export const ModelInfoSchema = z.object({
  provider: z.string().min(1),
  name: z.string().min(1),
  fallback_used: z.boolean().nullish(),
  fallback_reason: z.string().nullish(),
});

export const ResponseMetadataSchema = z.object({
  trace_id: z.string().min(1).nullish(),
  // http(s) only: this value becomes an href.
  trace_url: z.url({ protocol: /^https?$/ }).nullish(),
  model: ModelInfoSchema.nullish(),
  params: z
    .object({
      temperature: z.number().nullish(),
      top_k: z.number().int().min(1).nullish(),
      max_tokens: z.number().int().min(1).nullish(),
    })
    .nullish(),
  usage: z
    .object({
      prompt_tokens: z.number().int().min(0),
      completion_tokens: z.number().int().min(0),
    })
    .nullish(),
  estimated_cost_usd: z.number().min(0).nullish(),
  latency_ms: LatencyBreakdownSchema.nullish(),
  spans: z.array(SpanSchema).nullish(),
});

/* -------------------------------------------------------------------------------------------------
 * §1 POST /chat: request, assistant message, stream events
 * -----------------------------------------------------------------------------------------------*/

export const HistoryToolCallSchema = z.object({
  name: z.string().min(1),
  arguments: z.record(z.string(), z.unknown()),
  result: z.unknown(),
});

export const UserHistoryMessageSchema = z.object({
  role: z.literal("user"),
  id: IdSchema.nullish(),
  content: z.string(),
});

export const AssistantHistoryMessageSchema = z.object({
  role: z.literal("assistant"),
  id: IdSchema.nullish(),
  content: z.string(),
  tool_calls: z.array(HistoryToolCallSchema).nullish(),
});

export const HistoryMessageSchema = z.discriminatedUnion("role", [
  UserHistoryMessageSchema,
  AssistantHistoryMessageSchema,
]);

export const ChatRequestSchema = z.object({
  conversation_id: IdSchema,
  message: z.object({
    id: IdSchema,
    content: z.string().min(1).max(MAX_MESSAGE_CHARS),
  }),
  history: z.array(HistoryMessageSchema).max(MAX_HISTORY_MESSAGES),
  options: z.object({ regenerate_of: IdSchema.nullish() }).nullish(),
});

export const FinishReasonSchema = z.enum(["stop", "refusal", "length"]);

export const AssistantMessageSchema = z.object({
  id: IdSchema,
  conversation_id: IdSchema,
  role: z.literal("assistant"),
  created_at: DateTimeSchema,
  content: z.string(),
  finish_reason: FinishReasonSchema,
  retrieval: RetrievalSchema.nullable(),
  tool_calls: z.array(ToolCallSchema),
  refusal: RefusalSchema.nullable(),
  metadata: ResponseMetadataSchema.nullish(),
});

export const PipelinePhaseSchema = z.enum([
  "embedding",
  "retrieving",
  "filtering",
  "calling_tool",
  "generating",
]);

export const MessageStartEventSchema = z.object({
  type: z.literal("message.start"),
  message_id: IdSchema,
  conversation_id: IdSchema,
  created_at: DateTimeSchema,
});

export const StatusEventSchema = z.object({
  type: z.literal("status"),
  phase: PipelinePhaseSchema,
  label: z.string().nullish(),
});

export const RetrievalEventSchema = z.object({
  type: z.literal("retrieval"),
  retrieval: RetrievalSchema,
});

export const MessageDeltaEventSchema = z.object({
  type: z.literal("message.delta"),
  delta: z.string(),
});

export const CitationEventSchema = z.object({
  type: z.literal("citation"),
  rank: z.number().int().min(1),
  chunk_id: IdSchema,
});

export const ToolCallStartEventSchema = z.object({
  type: z.literal("tool_call.start"),
  tool_call: ToolCallStartSchema,
});

export const ToolCallResultEventSchema = z.object({
  type: z.literal("tool_call.result"),
  tool_call: ToolCallSchema,
});

export const RefusalEventSchema = z.object({
  type: z.literal("refusal"),
  refusal: RefusalSchema,
});

export const MessageEndEventSchema = z.object({
  type: z.literal("message.end"),
  message: AssistantMessageSchema,
});

export const ErrorEventSchema = z.object({
  type: z.literal("error"),
  error: ApiErrorBodySchema,
});

export const ChatStreamEventSchema = z.discriminatedUnion("type", [
  MessageStartEventSchema,
  StatusEventSchema,
  RetrievalEventSchema,
  MessageDeltaEventSchema,
  CitationEventSchema,
  ToolCallStartEventSchema,
  ToolCallResultEventSchema,
  RefusalEventSchema,
  MessageEndEventSchema,
  ErrorEventSchema,
]);

export const CHAT_STREAM_EVENT_TYPES = [
  "message.start",
  "status",
  "retrieval",
  "message.delta",
  "citation",
  "tool_call.start",
  "tool_call.result",
  "refusal",
  "message.end",
  "error",
] as const satisfies readonly z.infer<typeof ChatStreamEventSchema>["type"][];

export const TERMINAL_EVENT_TYPES = ["message.end", "error"] as const;

/* -------------------------------------------------------------------------------------------------
 * §7–9 GET /health, GET /documents, POST /feedback
 * -----------------------------------------------------------------------------------------------*/

export const ModelHealthSchema = z.object({
  provider: z.string().min(1),
  name: z.string().min(1),
  available: z.boolean(),
  latency_ms: Milliseconds.nullish(),
});

export const HealthStatusSchema = z.enum(["ok", "degraded", "down"]);

export const HealthResponseSchema = z.object({
  status: HealthStatusSchema,
  checked_at: DateTimeSchema,
  contract_version: z.string().nullish(),
  version: z.string().nullish(),
  uptime_s: z.number().min(0).nullish(),
  models: z.object({
    primary: ModelHealthSchema,
    fallback: ModelHealthSchema.nullish(),
  }),
  vector_store: z.object({
    provider: z.string().min(1),
    available: z.boolean(),
    document_count: z.number().int().min(0),
    chunk_count: z.number().int().min(0).nullish(),
    collection: z.string().nullish(),
  }),
  embeddings: z
    .object({ model: z.string().min(1), dimensions: z.number().int().min(1).nullish() })
    .nullish(),
  langfuse_enabled: z.boolean().nullish(),
});

export const KnowledgeDocumentSchema = SourceDocumentSchema.extend({
  chunk_count: z.number().int().min(0).nullish(),
});

export const DocumentsResponseSchema = z.object({
  documents: z.array(KnowledgeDocumentSchema),
  total: z.number().int().min(0),
});

export const FeedbackValueSchema = z.enum(["up", "down"]);

export const FeedbackRequestSchema = z.object({
  conversation_id: IdSchema,
  message_id: IdSchema,
  trace_id: z.string().nullish(),
  value: FeedbackValueSchema.nullable(),
  comment: z.string().max(1000).nullish(),
});

/* -------------------------------------------------------------------------------------------------
 * Inferred types
 * -----------------------------------------------------------------------------------------------*/

export type Money = z.infer<typeof MoneySchema>;
export type DistanceMetric = z.infer<typeof DistanceMetricSchema>;
export type SourceDocument = z.infer<typeof SourceDocumentSchema>;
export type SourceChunk = z.infer<typeof SourceChunkSchema>;
export type Retrieval = z.infer<typeof RetrievalSchema>;

export type OrderStatus = z.infer<typeof OrderStatusSchema>;
export type TimelineState = z.infer<typeof TimelineStateSchema>;
export type OrderTimelineEvent = z.infer<typeof OrderTimelineEventSchema>;
export type OrderItem = z.infer<typeof OrderItemSchema>;
export type LookupOrderArguments = z.infer<typeof LookupOrderArgumentsSchema>;
export type LookupOrderResult = z.infer<typeof LookupOrderResultSchema>;
export type ToolError = z.infer<typeof ToolErrorSchema>;
export type LookupOrderToolCall = z.infer<typeof LookupOrderToolCallSchema>;
export type GenericToolCall = z.infer<typeof GenericToolCallSchema>;
export type ToolCall = z.infer<typeof ToolCallSchema>;
export type ToolCallStart = z.infer<typeof ToolCallStartSchema>;

export type BelowThresholdRefusal = z.infer<typeof BelowThresholdRefusalSchema>;
export type PolicyRefusal = z.infer<typeof PolicyRefusalSchema>;
export type Refusal = z.infer<typeof RefusalSchema>;

export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>;
export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;

export type LatencyBreakdown = z.infer<typeof LatencyBreakdownSchema>;
export type SpanKind = z.infer<typeof SpanKindSchema>;
export type Span = z.infer<typeof SpanSchema>;
export type ModelInfo = z.infer<typeof ModelInfoSchema>;
export type ResponseMetadata = z.infer<typeof ResponseMetadataSchema>;

export type HistoryToolCall = z.infer<typeof HistoryToolCallSchema>;
export type HistoryMessage = z.infer<typeof HistoryMessageSchema>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type FinishReason = z.infer<typeof FinishReasonSchema>;
export type AssistantMessage = z.infer<typeof AssistantMessageSchema>;
export type PipelinePhase = z.infer<typeof PipelinePhaseSchema>;

export type MessageStartEvent = z.infer<typeof MessageStartEventSchema>;
export type StatusEvent = z.infer<typeof StatusEventSchema>;
export type RetrievalEvent = z.infer<typeof RetrievalEventSchema>;
export type MessageDeltaEvent = z.infer<typeof MessageDeltaEventSchema>;
export type CitationEvent = z.infer<typeof CitationEventSchema>;
export type ToolCallStartEvent = z.infer<typeof ToolCallStartEventSchema>;
export type ToolCallResultEvent = z.infer<typeof ToolCallResultEventSchema>;
export type RefusalEvent = z.infer<typeof RefusalEventSchema>;
export type MessageEndEvent = z.infer<typeof MessageEndEventSchema>;
export type ErrorEvent = z.infer<typeof ErrorEventSchema>;
export type ChatStreamEvent = z.infer<typeof ChatStreamEventSchema>;
export type ChatStreamEventType = ChatStreamEvent["type"];

export type ModelHealth = z.infer<typeof ModelHealthSchema>;
export type HealthStatus = z.infer<typeof HealthStatusSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type KnowledgeDocument = z.infer<typeof KnowledgeDocumentSchema>;
export type DocumentsResponse = z.infer<typeof DocumentsResponseSchema>;
export type FeedbackValue = z.infer<typeof FeedbackValueSchema>;
export type FeedbackRequest = z.infer<typeof FeedbackRequestSchema>;

/* -------------------------------------------------------------------------------------------------
 * Helpers
 * -----------------------------------------------------------------------------------------------*/

export function isLookupOrderCall(call: ToolCall): call is LookupOrderToolCall {
  return call.name === "lookup_order";
}

const knownEventTypes: ReadonlySet<string> = new Set(CHAT_STREAM_EVENT_TYPES);

export type ParsedStreamEvent =
  | { kind: "event"; event: ChatStreamEvent }
  /** Forward compatibility: unknown event types are skipped, never fatal. */
  | { kind: "unknown"; type: string }
  | { kind: "invalid"; type: string; issues: string };

/** Validate one decoded SSE `data` payload. */
export function parseStreamEvent(raw: unknown): ParsedStreamEvent {
  const type =
    typeof raw === "object" && raw !== null && "type" in raw && typeof raw.type === "string"
      ? raw.type
      : "";
  if (!knownEventTypes.has(type)) return { kind: "unknown", type };
  const parsed = ChatStreamEventSchema.safeParse(raw);
  if (parsed.success) return { kind: "event", event: parsed.data };
  return { kind: "invalid", type, issues: summarizeIssues(parsed.error) };
}

/** Compact "path: message" summary for contract_violation errors and dev logs. */
export function summarizeIssues(error: z.ZodError, limit = 3): string {
  const lines = error.issues.slice(0, limit).map((issue) => {
    const path = issue.path.map(String).join(".") || "(root)";
    return `${path}: ${issue.message}`;
  });
  const more = error.issues.length > limit ? ` (+${error.issues.length - limit} more)` : "";
  return lines.join("; ") + more;
}
