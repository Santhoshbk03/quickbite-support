/**
 * The mock's "backend": a keyword retriever with plausible distance behaviour, order-intent
 * detection, and answer composition.
 *
 * It is deliberately more than a lookup table of canned replies. Ask it something the scripts never
 * anticipated and it retrieves real chunks, refuses when nothing clears the threshold, and composes
 * an answer from the chunks it did find — so the UI is exercised by genuinely variable input.
 *
 * Scoring is tuned so in-scope questions land around 0.20–0.45 and out-of-scope questions land
 * above the 0.55 threshold. It is not an embedding model; it only has to be convincingly shaped
 * like one.
 */
import {
  buildLookupOrderResult,
  estimateTokens,
  findOrder,
  formatRupees,
  getChunk,
  matchScriptedTurn,
  normalizeOrderId,
  KNOWLEDGE_CHUNKS,
} from "@/lib/fixtures";
import type { KnowledgeChunk, ScriptedTurnMatch } from "@/lib/fixtures";
import { isLookupOrderCall } from "../schemas";
import type {
  ChatRequest,
  FinishReason,
  LookupOrderResult,
  ModelInfo,
  Refusal,
  Retrieval,
  SourceChunk,
  ToolCall,
} from "../schemas";
import { PIPELINE } from "./profiles";
import type { TimingProfile } from "./profiles";
import type { Random } from "./random";

export interface PlanTimings {
  embedding: number;
  retrieval: number;
  filtering: number;
  /** Retrieval finished until the first token. */
  ttft: number;
  /** Total LLM wall time, ttft included. */
  generation: number;
}

export interface ResponsePlan {
  /** Final content, including any preamble streamed before a tool call. */
  content: string;
  toolCalls: ToolCall[];
  retrieval: Retrieval | null;
  refusal: Refusal | null;
  finishReason: FinishReason;
  model: ModelInfo;
  temperature: number;
  usage: { prompt_tokens: number; completion_tokens: number } | null;
  timings: PlanTimings;
  traceId: string;
  source: "scripted" | "improvised";
}

export interface PlanContext {
  now: Date;
  rng: Random;
  profile: TimingProfile;
}

export function planResponse(request: ChatRequest, context: PlanContext): ResponsePlan {
  const question = request.message.content.trim();
  const priorUserMessages = request.history
    .filter((message) => message.role === "user")
    .map((message) => message.content);

  const scripted = matchScriptedTurn(question, priorUserMessages);
  return scripted ? planScripted(scripted, context) : planImprovised(question, request, context);
}

/* -----------------------------------------------------------------------------------------------
 * Scripted turns
 * ---------------------------------------------------------------------------------------------*/

function planScripted(match: ScriptedTurnMatch, context: PlanContext): ResponsePlan {
  const { turn } = match;
  const { rng, now } = context;

  const chunks = turn.chunks.map((ref, index) =>
    toSourceChunk(getChunk(ref.id), index + 1, ref.distance),
  );

  const retrieval: Retrieval = {
    query: turn.user,
    standalone_query: turn.standalone_query ?? null,
    top_k: PIPELINE.topK,
    distance_metric: PIPELINE.distanceMetric,
    threshold: PIPELINE.threshold,
    embedding_model: PIPELINE.embeddingModel,
    collection: PIPELINE.collection,
    chunks,
  };

  const preamble = turn.preamble ?? "";
  const content = `${preamble}${turn.content}`;

  const toolCalls: ToolCall[] = [];
  if (turn.tool_call) {
    toolCalls.push(
      buildLookupOrderCall({
        id: "tc_1",
        rawOrderId: turn.tool_call.order_id,
        contentOffset: [...preamble].length,
        durationMs: turn.tool_call.duration_ms,
        now,
      }),
    );
  }

  const refusal: Refusal | null = turn.refusal
    ? {
        reason: "below_threshold",
        message: turn.refusal.message,
        threshold: PIPELINE.threshold,
        distance_metric: PIPELINE.distanceMetric,
        closest_match: chunks[0] ?? null,
        suggestions: turn.refusal.suggestions,
      }
    : null;

  const model: ModelInfo = turn.model
    ? {
        provider: turn.model.provider,
        name: turn.model.name,
        fallback_used: turn.model.fallback_used,
        fallback_reason: turn.model.fallback_reason ?? null,
      }
    : { ...PIPELINE.primaryModel, fallback_used: false, fallback_reason: null };

  return {
    content,
    toolCalls,
    retrieval,
    refusal,
    finishReason: refusal ? "refusal" : "stop",
    model,
    temperature: PIPELINE.temperature,
    usage: refusal ? null : (turn.usage ?? null),
    timings: turn.timings,
    traceId: rng.hex(32),
    source: "scripted",
  };
}

/* -----------------------------------------------------------------------------------------------
 * Improvised turns
 * ---------------------------------------------------------------------------------------------*/

const GREETING_RE = /^(hi|hey|hello|yo|namaste|good (morning|afternoon|evening))\b/i;
const THANKS_RE = /^(thanks|thank you|thanks a lot|cheers|ty)\b/i;
const ORDER_ID_RE = /\b#?\s?(QB[\s-]?\d{5})\b/i;
const REFERENTIAL_RE = /\b(it|its|it's|that|this|the order|my order|the delay|same order|them)\b/i;
const ORDER_INTENT_RE =
  /\b(where|status|track|tracking|eta|how long|late|arriv\w*|coming|stuck|delay\w*|cancel\w*|refund\w*|missing|wrong|cold|charged)\b/i;

function planImprovised(
  question: string,
  request: ChatRequest,
  context: PlanContext,
): ResponsePlan {
  const { rng, profile, now } = context;

  if (GREETING_RE.test(question) || THANKS_RE.test(question)) {
    return planSmallTalk(question, context);
  }

  // 1. Resolve which order the question is about, if any.
  const explicitOrderId = ORDER_ID_RE.exec(question)?.[1] ?? null;
  const contextOrderId =
    explicitOrderId ??
    (REFERENTIAL_RE.test(question) && ORDER_INTENT_RE.test(question)
      ? findOrderIdInHistory(request)
      : null);

  // 2. Retrieve. A follow-up gets its query rewritten first, which is what the real pipeline does.
  const isFollowUp =
    !explicitOrderId && REFERENTIAL_RE.test(question) && request.history.length > 0;
  const previousUserMessage = [...request.history]
    .reverse()
    .find((message) => message.role === "user")?.content;
  const standaloneQuery =
    isFollowUp && previousUserMessage
      ? `${question} (in the context of: ${previousUserMessage})`
      : null;

  const retrieval = retrieve(question, standaloneQuery, rng);
  const passed = retrieval.chunks.filter((chunk) => chunk.passed_threshold);

  // 3. Tool call, if an order is in play.
  const toolCalls: ToolCall[] = [];
  let orderResult: LookupOrderResult | null = null;
  let orderLookupFailed = false;
  let preamble = "";

  if (contextOrderId) {
    preamble = rng.pick([
      `Let me pull up order **${normalizeOrderId(contextOrderId) ?? contextOrderId}**.`,
      `Checking order **${normalizeOrderId(contextOrderId) ?? contextOrderId}** now.`,
      `One moment — looking up **${normalizeOrderId(contextOrderId) ?? contextOrderId}**.`,
    ]);
    const call = buildLookupOrderCall({
      id: "tc_1",
      rawOrderId: contextOrderId,
      contentOffset: [...preamble].length,
      durationMs: rng.range(profile.toolDuration),
      now,
    });
    toolCalls.push(call);
    // The guard is needed because an unknown tool's `result` is deliberately `unknown`.
    if (isLookupOrderCall(call) && call.status === "success" && call.result) {
      orderResult = call.result;
    } else {
      orderLookupFailed = true;
    }
  }

  // 4. Compose. A refusal only happens when nothing was retrieved *and* no tool answered.
  let body: string;
  let refusal: Refusal | null = null;

  if (orderResult) {
    body = composeOrderAnswer(orderResult, passed, now);
  } else if (orderLookupFailed) {
    body = composeLookupFailure(contextOrderId ?? "");
  } else if (passed.length === 0) {
    refusal = buildRefusal(retrieval);
    body = refusal.message;
  } else if (
    ORDER_INTENT_RE.test(question) &&
    /\b(where|status|track|eta|how long)\b/i.test(question)
  ) {
    body = composeAskForOrderId(passed);
  } else {
    body = composePolicyAnswer(passed);
  }

  const content = `${preamble}${preamble ? "\n\n" : ""}${body}`;
  const model = pickModel(context);
  const timings = improvisedTimings({
    content,
    hasTool: toolCalls.length > 0,
    refusal,
    model,
    context,
  });
  const usage = refusal
    ? null
    : {
        prompt_tokens: estimatePromptTokens(request, passed, toolCalls.length > 0),
        completion_tokens: estimateTokens(content),
      };

  return {
    content,
    toolCalls,
    retrieval,
    refusal,
    finishReason: refusal ? "refusal" : "stop",
    model,
    temperature: PIPELINE.temperature,
    usage,
    timings,
    traceId: rng.hex(32),
    source: "improvised",
  };
}

function planSmallTalk(question: string, context: PlanContext): ResponsePlan {
  const { rng, profile } = context;
  const content = THANKS_RE.test(question)
    ? "Happy to help. Anything else about an order or a policy?"
    : "Hi. I can explain QuickBite's policies — refunds, late deliveries, cancellations, allergens — and look up an order if you share its ID, like QB-48213.";

  const ttft = rng.range(profile.ttft);
  const completionTokens = estimateTokens(content);
  return {
    content,
    toolCalls: [],
    // Small talk skips retrieval entirely, which the contract allows (retrieval: null).
    retrieval: null,
    refusal: null,
    finishReason: "stop",
    model: { ...PIPELINE.primaryModel, fallback_used: false, fallback_reason: null },
    temperature: PIPELINE.temperature,
    usage: {
      prompt_tokens: PIPELINE.systemPromptTokens + estimateTokens(question),
      completion_tokens: completionTokens,
    },
    timings: {
      embedding: 0,
      retrieval: 0,
      filtering: 0,
      ttft,
      generation: ttft + (completionTokens / rng.range(profile.tokensPerSecond)) * 1000,
    },
    traceId: rng.hex(32),
    source: "improvised",
  };
}

function pickModel(context: PlanContext): ModelInfo {
  const { rng, profile } = context;
  if (profile.fallbackChance > 0 && rng.chance(profile.fallbackChance)) {
    return {
      ...PIPELINE.fallbackModel,
      fallback_used: true,
      fallback_reason: "groq: 429 rate_limit_exceeded",
    };
  }
  return { ...PIPELINE.primaryModel, fallback_used: false, fallback_reason: null };
}

function improvisedTimings(args: {
  content: string;
  hasTool: boolean;
  refusal: Refusal | null;
  model: ModelInfo;
  context: PlanContext;
}): PlanTimings {
  const { content, hasTool, refusal, model, context } = args;
  const { rng, profile } = context;

  const embedding = rng.range(profile.embedding);
  const retrieval = rng.range(profile.retrieval);
  const filtering = rng.range(profile.filtering);

  // A below-threshold refusal never reaches the model: no tokens, no generation time, no cost.
  if (refusal) {
    return { embedding, retrieval, filtering, ttft: 0, generation: 0 };
  }

  // The Ollama fallback is meaningfully slower, and the timeline should show that honestly.
  const tps = rng.range(
    model.fallback_used ? profile.fallbackTokensPerSecond : profile.tokensPerSecond,
  );
  const ttft = rng.range(profile.ttft);
  const streamMs = (estimateTokens(content) / tps) * 1000;
  // A tool call splits generation into two LLM calls, so there is a second (shorter) prefill.
  const secondPrefill = hasTool ? ttft * 0.45 : 0;

  return { embedding, retrieval, filtering, ttft, generation: ttft + streamMs + secondPrefill };
}

function estimatePromptTokens(
  request: ChatRequest,
  passed: SourceChunk[],
  hasToolResult: boolean,
): number {
  const historyTokens = request.history.reduce(
    (sum, message) => sum + estimateTokens(message.content),
    0,
  );
  const contextTokens = passed.reduce((sum, chunk) => sum + (chunk.token_count ?? 0), 0);
  return (
    PIPELINE.systemPromptTokens +
    contextTokens +
    historyTokens +
    estimateTokens(request.message.content) +
    (hasToolResult ? 210 : 0)
  );
}

function findOrderIdInHistory(request: ChatRequest): string | null {
  for (const message of [...request.history].reverse()) {
    if (message.role === "assistant" && message.tool_calls) {
      for (const call of message.tool_calls) {
        const argument = call.arguments["order_id"];
        if (typeof argument === "string") {
          const normalized = normalizeOrderId(argument);
          if (normalized) return normalized;
        }
      }
    }
    const match = ORDER_ID_RE.exec(message.content);
    if (match) {
      const normalized = normalizeOrderId(match[1]);
      if (normalized) return normalized;
    }
  }
  return null;
}

/* -----------------------------------------------------------------------------------------------
 * Retrieval
 * ---------------------------------------------------------------------------------------------*/

const STOPWORDS: ReadonlySet<string> = new Set(
  "a about after all also am an and any are as at be because been but by can cant cannot did do does doesnt doing dont for from get got had has have how i if im in into is isnt it its just me my no nor not of off on once only or our out over own same should so some still such than that the their them then there these they this those to too very was wasnt we were what when where which who why will with would you your yours".split(
    " ",
  ),
);

function stem(word: string): string {
  if (word.length <= 4) return word;
  for (const suffix of ["ing", "ed", "es", "s"]) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 4) {
      return word.slice(0, word.length - suffix.length);
    }
  }
  return word;
}

function extractTerms(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOPWORDS.has(word))
    .map(stem);
}

interface IndexEntry {
  chunk: KnowledgeChunk;
  weights: Map<string, number>;
}

/** Field-weighted term index over the fixture corpus, built once. */
const INDEX: readonly IndexEntry[] = KNOWLEDGE_CHUNKS.map((chunk) => {
  const weights = new Map<string, number>();
  const addField = (text: string, weight: number, cap = 3) => {
    const counts = new Map<string, number>();
    for (const term of extractTerms(text)) {
      counts.set(term, Math.min(cap, (counts.get(term) ?? 0) + 1));
    }
    for (const [term, count] of counts) {
      weights.set(term, (weights.get(term) ?? 0) + weight * count);
    }
  };
  addField(chunk.keywords.join(" "), 3);
  addField(chunk.document.title, 2.2);
  addField(chunk.document.section ?? "", 1.6);
  addField(chunk.text, 1);
  return { chunk, weights };
});

const DOCUMENT_FREQUENCY: ReadonlyMap<string, number> = (() => {
  const frequency = new Map<string, number>();
  for (const entry of INDEX) {
    for (const term of entry.weights.keys()) {
      frequency.set(term, (frequency.get(term) ?? 0) + 1);
    }
  }
  return frequency;
})();

/** Minimum field weight that counts as a topical match: keywords (3), title (2.2), or section (1.6). */
const TOPICAL_WEIGHT_MIN = 1.6;

function inverseDocumentFrequency(term: string): number {
  const df = DOCUMENT_FREQUENCY.get(term) ?? 0;
  return Math.log(1 + INDEX.length / (1 + df));
}

function retrieve(question: string, standaloneQuery: string | null, rng: Random): Retrieval {
  const embeddedText = standaloneQuery ?? question;
  const terms = [...new Set(extractTerms(embeddedText))];

  const scored = INDEX.map((entry) => {
    let raw = 0;
    let matched = 0;
    for (const term of terms) {
      const weight = entry.weights.get(term);
      if (weight) {
        raw += weight * inverseDocumentFrequency(term);
        // Half credit for a term that only appears in prose. Embeddings capture topicality, so a
        // chunk about tipping should not look like a match for "what do riders get paid per hour?"
        // just because the words "paid" and "hours" happen to occur in its body text.
        matched += weight >= TOPICAL_WEIGHT_MIN ? 1 : 0.5;
      }
    }
    const coverage = terms.length === 0 ? 0 : matched / terms.length;
    const saturated = raw / (raw + 6);
    // Vocabulary the corpus has never seen is the strongest out-of-domain signal available to a
    // keyword scorer, and it is what keeps "what do riders earn?" on the refusing side.
    const unknownRatio =
      terms.length === 0
        ? 1
        : terms.filter((term) => !DOCUMENT_FREQUENCY.has(term)).length / terms.length;
    const score = saturated * (0.42 + 0.58 * coverage) * (1 - 0.55 * unknownRatio);
    return { chunk: entry.chunk, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const chunks = scored.slice(0, PIPELINE.topK).map((entry, index) => {
    const jitter = (rng.next() - 0.5) * 0.04;
    const distance = clamp(0.92 - 0.7 * entry.score + jitter, 0.09, 1.05);
    return toSourceChunk(entry.chunk, index + 1, round(distance, 3));
  });

  return {
    query: question,
    standalone_query: standaloneQuery,
    top_k: PIPELINE.topK,
    distance_metric: PIPELINE.distanceMetric,
    threshold: PIPELINE.threshold,
    embedding_model: PIPELINE.embeddingModel,
    collection: PIPELINE.collection,
    chunks,
  };
}

function toSourceChunk(chunk: KnowledgeChunk, rank: number, distance: number): SourceChunk {
  return {
    id: chunk.id,
    rank,
    distance,
    passed_threshold: distance <= PIPELINE.threshold,
    // The player sets the final value from the citation markers in the content.
    used_in_answer: false,
    text: chunk.text,
    document: chunk.document,
    chunk_index: chunk.chunk_index,
    token_count: chunk.token_count,
  };
}

/* -----------------------------------------------------------------------------------------------
 * Tool calls
 * ---------------------------------------------------------------------------------------------*/

function buildLookupOrderCall(args: {
  id: string;
  rawOrderId: string;
  contentOffset: number;
  durationMs: number;
  now: Date;
}): ToolCall {
  const { id, rawOrderId, contentOffset, durationMs, now } = args;
  const normalized = normalizeOrderId(rawOrderId);
  const order = findOrder(rawOrderId);

  if (!order) {
    return {
      id,
      name: "lookup_order",
      arguments: { order_id: normalized ?? rawOrderId },
      status: "error",
      result: null,
      error: {
        code: normalized ? "order_not_found" : "invalid_order_id",
        message: normalized
          ? `No order found with id ${normalized}.`
          : `"${rawOrderId}" is not a valid QuickBite order id.`,
      },
      duration_ms: round(durationMs, 1),
      content_offset: contentOffset,
    };
  }

  return {
    id,
    name: "lookup_order",
    arguments: { order_id: order.order_id },
    status: "success",
    result: buildLookupOrderResult(order, now),
    error: null,
    duration_ms: round(durationMs, 1),
    content_offset: contentOffset,
  };
}

/* -----------------------------------------------------------------------------------------------
 * Answer composition
 * ---------------------------------------------------------------------------------------------*/

const LEAD_BY_CATEGORY: Record<string, string> = {
  refunds: "Here's how refunds work at QuickBite:",
  orders: "Here's what applies to that order:",
  delivery: "Here's how QuickBite handles that:",
  payments: "Here's how that's charged, and when it comes back:",
  account: "Here's the account policy on that:",
  safety: "Here's what our safety policy says:",
  riders: "Here's the policy on delivery partners:",
  promotions: "Here's how offers work:",
  membership: "Here's what QuickBite Plus covers:",
  community: "Here's the guideline:",
};

const CLOSER_BY_CATEGORY: Record<string, string> = {
  refunds: "If you share the order ID, I can tell you exactly what applies to it.",
  orders: "Share the order ID and I can check the specifics for that order.",
  delivery: "Share the order ID and I can check where it stands right now.",
  safety:
    "If this is about an order you've received, report it from the order page so the safety team sees it.",
};

/** Chunks worth citing: always the closest, plus near-ties. The rest stay retrieved-but-unused. */
function selectCited(passed: SourceChunk[]): SourceChunk[] {
  if (passed.length === 0) return [];
  const best = passed[0];
  const cited = [best];
  for (const chunk of passed.slice(1)) {
    if (chunk.distance - best.distance <= 0.14 && cited.length < 2) cited.push(chunk);
  }
  return cited;
}

function composePolicyAnswer(passed: SourceChunk[]): string {
  const cited = selectCited(passed);
  const category = cited[0].document.category ?? "";
  const lead = LEAD_BY_CATEGORY[category] ?? "Here's what the policy says:";
  const bullets = cited.map((chunk) => `- ${getChunk(chunk.id).gist} [${chunk.rank}]`).join("\n");
  const closer = CLOSER_BY_CATEGORY[category] ?? "";
  return closer ? `${lead}\n\n${bullets}\n\n${closer}` : `${lead}\n\n${bullets}`;
}

function composeAskForOrderId(passed: SourceChunk[]): string {
  const cited = selectCited(passed).slice(0, 1);
  const bullets = cited.map((chunk) => `- ${getChunk(chunk.id).gist} [${chunk.rank}]`).join("\n");
  return `I can check that for you — what's the order ID? It looks like **QB-48213** and sits at the top of the order's page in the app.\n\n${bullets}`;
}

function composeLookupFailure(rawOrderId: string): string {
  return `I couldn't find an order with the ID **${rawOrderId.toUpperCase()}**. QuickBite order IDs look like **QB-48213** — you'll find the exact one at the top of the order's page in the app. Send it across and I'll take another look.`;
}

function composeOrderAnswer(order: LookupOrderResult, passed: SourceChunk[], now: Date): string {
  const restaurant = `**${order.restaurant.name}**`;
  const minutesRemaining = order.eta?.minutes_remaining ?? null;
  const lines: string[] = [];

  switch (order.status) {
    case "out_for_delivery": {
      const rider = order.rider ? ` with ${order.rider.first_name}` : "";
      lines.push(
        `Your order from ${restaurant} is **out for delivery**${rider}${
          minutesRemaining ? ` and should reach you in about **${minutesRemaining} minutes**` : ""
        }.`,
      );
      break;
    }
    case "preparing":
      lines.push(
        `${restaurant} is still preparing your order${
          minutesRemaining
            ? `, with the live estimate about **${minutesRemaining} minutes** out`
            : ""
        }.`,
      );
      break;
    case "confirmed":
    case "placed":
      lines.push(
        `${restaurant} has your order${
          minutesRemaining ? ` and the estimate is about **${minutesRemaining} minutes**` : ""
        }. It hasn't gone to the kitchen queue long enough to show progress yet.`,
      );
      break;
    case "delivered": {
      const minutesAgo = order.delivered_at
        ? Math.max(1, Math.round((now.getTime() - Date.parse(order.delivered_at)) / 60_000))
        : null;
      lines.push(
        `That order from ${restaurant} was delivered${minutesAgo ? ` ${minutesAgo} minutes ago` : ""}, and the total was **${formatRupees(order.totals.total.amount_minor)}**.`,
      );
      break;
    }
    case "cancelled": {
      const by = order.cancellation?.by;
      const reason = order.cancellation?.reason;
      lines.push(
        `That order from ${restaurant} was cancelled${by ? ` by the ${by === "quickbite" ? "platform" : by}` : ""}${reason ? ` — ${reason.toLowerCase()}` : ""}.`,
      );
      if (order.refund) {
        lines.push(
          `The refund of **${formatRupees(order.refund.amount.amount_minor)}** is ${order.refund.status} to ${order.refund.method}.`,
        );
      }
      break;
    }
  }

  if (order.eta?.is_late && order.eta.minutes_late) {
    lines.push(
      `It is running **${order.eta.minutes_late} minutes** behind the time promised at checkout.`,
    );
  }

  const cited = selectCited(passed);
  const bullets = cited.map((chunk) => `- ${getChunk(chunk.id).gist} [${chunk.rank}]`).join("\n");

  return bullets ? `${lines.join(" ")}\n\n${bullets}` : lines.join(" ");
}

/* -----------------------------------------------------------------------------------------------
 * Refusals
 * ---------------------------------------------------------------------------------------------*/

const SUGGESTION_BY_DOCUMENT: Record<string, string> = {
  "doc_late-delivery-compensation": "How does QuickBite handle late deliveries?",
  "doc_missing-items": "What's the refund window for a missing item?",
  "doc_refunds-and-credits": "How do refunds work at QuickBite?",
  "doc_refund-timelines": "How long does a refund take to reach me?",
  "doc_cancellations-customer": "Can I cancel after the restaurant confirms?",
  "doc_cancellations-restaurant": "What happens when a restaurant cancels my order?",
  doc_allergens: "Where does allergen information on the menu come from?",
  "doc_food-safety": "I found something in my food — how do I report it?",
  "doc_food-quality": "My food arrived cold. What can I claim?",
  "doc_rider-conduct": "What conduct standards do QuickBite riders follow?",
  doc_tipping: "How does tipping my delivery partner work?",
  "doc_delivery-fees": "Why was I charged a delivery fee?",
  "doc_delivery-tracking": "How is my delivery estimate calculated?",
  "doc_promo-codes": "Do I get my promo code back if an order is cancelled?",
  doc_payments: "My payment failed but the money was debited. What now?",
  doc_wallet: "When do QuickBite Wallet credits expire?",
  "doc_plus-membership": "What does QuickBite Plus include?",
  "doc_account-security": "Someone placed an order on my account. What do I do?",
  "doc_account-deletion": "How do I delete my account?",
  "doc_scheduled-orders": "Can I schedule an order for later?",
  "doc_service-disruptions": "What happens to my order during heavy rain?",
  "doc_failed-delivery": "The rider marked my order delivered but it never arrived.",
  "doc_restricted-items": "Do you deliver alcohol?",
  doc_reviews: "Can I change the rating I left?",
  "doc_fair-use": "Why is my refund claim going to manual review?",
};

const FALLBACK_SUGGESTIONS = [
  "How does QuickBite handle late deliveries?",
  "What's the refund window for a missing item?",
  "Can I cancel after the restaurant confirms?",
];

function buildRefusal(retrieval: Retrieval): Refusal {
  const suggestions: string[] = [];
  for (const chunk of retrieval.chunks) {
    const suggestion = SUGGESTION_BY_DOCUMENT[chunk.document.id];
    if (suggestion && !suggestions.includes(suggestion)) suggestions.push(suggestion);
  }
  for (const suggestion of FALLBACK_SUGGESTIONS) {
    if (suggestions.length >= 3) break;
    if (!suggestions.includes(suggestion)) suggestions.push(suggestion);
  }

  return {
    reason: "below_threshold",
    message:
      "I don't have a policy document that covers that, so I'd rather not guess. I can only answer from QuickBite's published support policies.",
    threshold: retrieval.threshold,
    distance_metric: retrieval.distance_metric,
    closest_match: retrieval.chunks[0] ?? null,
    suggestions: suggestions.slice(0, 3),
  };
}

/* -----------------------------------------------------------------------------------------------
 * Small helpers
 * ---------------------------------------------------------------------------------------------*/

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
