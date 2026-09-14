/**
 * Turns a {@link ResponsePlan} into a properly framed, properly paced event stream.
 *
 * Design notes that matter:
 * - Tokens are grouped into uneven bursts with occasional stalls, because real providers arrive in
 *   clumps. A metronome is the tell of a fake stream.
 * - The durations reported in `metadata.latency_ms` are the same numbers the player actually slept,
 *   so the inspector never contradicts what the viewer just watched.
 * - `used_in_answer` is derived from the citation markers in the finished text, which makes that
 *   invariant true by construction rather than by discipline.
 * - Scripted and improvised plans take this identical path, so replay is not a second code path.
 */
import type {
  AssistantMessage,
  ChatStreamEvent,
  ResponseMetadata,
  Retrieval,
  Span,
  ToolCall,
} from "../schemas";
import { estimateCostUsd, PIPELINE } from "./profiles";
import type { TimingProfile } from "./profiles";
import type { Random } from "./random";
import type { ResponsePlan } from "./engine";

export interface PlayerContext {
  plan: ResponsePlan;
  conversationId: string;
  messageId: string;
  now: Date;
  rng: Random;
  profile: TimingProfile;
  /** Delay before the first event: network round trip plus any cold start. */
  leadInMs: number;
  sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
  signal?: AbortSignal;
}

interface Segment {
  text: string;
  /** Tool call that fires immediately after this segment. */
  toolCall: ToolCall | null;
}

export async function* playResponse(
  context: PlayerContext,
): AsyncGenerator<ChatStreamEvent, void, void> {
  const { plan, profile, rng } = context;

  /** Planned-time clock in ms. Advances by the full duration even when sleeps are scaled to zero. */
  let clock = 0;
  const spans: Span[] = [];
  const sleep = async (ms: number): Promise<void> => {
    clock += ms;
    await context.sleep(ms * profile.sleepScale, context.signal);
  };

  await sleep(context.leadInMs);

  yield {
    type: "message.start",
    message_id: context.messageId,
    conversation_id: context.conversationId,
    created_at: context.now.toISOString(),
  };

  if (plan.retrieval) {
    yield { type: "status", phase: "embedding", label: "Embedding your question" };
    let start = clock;
    await sleep(plan.timings.embedding);
    spans.push(span("embed_query", "embedding", start, plan.timings.embedding));

    yield {
      type: "status",
      phase: "retrieving",
      label: `Searching ${PIPELINE.collection.replace(/_/g, " ")}`,
    };
    start = clock;
    await sleep(plan.timings.retrieval);
    spans.push(span("chroma.query", "retrieval", start, plan.timings.retrieval));

    yield { type: "status", phase: "filtering", label: "Applying distance threshold" };
    start = clock;
    await sleep(plan.timings.filtering);
    spans.push(span("threshold_filter", "filtering", start, plan.timings.filtering));

    yield { type: "retrieval", retrieval: plan.retrieval };
  }

  let timeToFirstToken: number | null = null;
  let toolTotal = 0;

  if (plan.refusal) {
    yield { type: "refusal", refusal: plan.refusal };
    // A below-threshold refusal never reaches the model: the text is a template, emitted in one
    // write, and generation time stays honestly zero.
    if (plan.content.length > 0) {
      timeToFirstToken = clock;
      yield { type: "message.delta", delta: plan.content };
    }
  } else {
    yield { type: "status", phase: "generating", label: "Generating an answer" };

    const segments = splitIntoSegments(plan);
    const prefillFirst = plan.timings.ttft;
    const laterPrefills = Math.max(0, segments.length - 1);
    const prefillLater = laterPrefills > 0 ? (plan.timings.ttft * 0.45) / laterPrefills : 0;
    const streamBudget = Math.max(
      0,
      plan.timings.generation - prefillFirst - prefillLater * laterPrefills,
    );

    const tokenized = segments.map((segment) => tokenizeForStreaming(segment.text, rng));
    const totalTokens = tokenized.reduce((sum, tokens) => sum + tokens.length, 0) || 1;

    let emitted = "";
    const citedRanks = new Set<number>();

    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      const tokens = tokenized[index];
      const segmentStart = clock;
      const prefill = index === 0 ? prefillFirst : prefillLater;
      await sleep(prefill);

      const segmentBudget = streamBudget * (tokens.length / totalTokens);
      for (const delta of paceDeltas(tokens, segmentBudget, rng, profile)) {
        await sleep(delta.delayMs);
        if (timeToFirstToken === null) timeToFirstToken = clock;
        emitted += delta.text;
        yield { type: "message.delta", delta: delta.text };

        // Fire a citation event the moment a marker completes, the same way a server watching its
        // own token stream would.
        for (const rank of findCitedRanks(emitted)) {
          if (citedRanks.has(rank)) continue;
          citedRanks.add(rank);
          const chunk = plan.retrieval?.chunks.find((candidate) => candidate.rank === rank);
          if (chunk && chunk.passed_threshold) {
            yield { type: "citation", rank, chunk_id: chunk.id };
          }
        }
      }

      spans.push(span("llm.generate", "generation", segmentStart, clock - segmentStart));

      if (segment.toolCall) {
        const call = segment.toolCall;
        yield { type: "status", phase: "calling_tool", label: `Calling ${call.name}` };
        yield {
          type: "tool_call.start",
          tool_call: {
            id: call.id,
            name: call.name,
            arguments: call.arguments,
            content_offset: call.content_offset ?? null,
          },
        };
        const toolStart = clock;
        const duration = call.duration_ms ?? 0;
        await sleep(duration);
        toolTotal += duration;
        spans.push(span(`tool.${call.name}`, "tool", toolStart, duration));
        yield { type: "tool_call.result", tool_call: call };
        if (index < segments.length - 1) {
          yield { type: "status", phase: "generating", label: "Generating an answer" };
        }
      }
    }
  }

  const finalRetrieval = applyCitationUsage(plan.retrieval, plan.content);
  const metadata: ResponseMetadata = {
    trace_id: plan.traceId,
    // Deliberately null: linking to a Langfuse trace that does not exist would be worse than no link.
    trace_url: null,
    model: plan.model,
    params: {
      temperature: plan.temperature,
      top_k: plan.retrieval?.top_k ?? PIPELINE.topK,
      max_tokens: PIPELINE.maxTokens,
    },
    usage: plan.usage,
    estimated_cost_usd: plan.usage
      ? estimateCostUsd(plan.model.name, plan.usage.prompt_tokens, plan.usage.completion_tokens)
      : 0,
    latency_ms: {
      total: round(clock, 1),
      time_to_first_token: timeToFirstToken === null ? null : round(timeToFirstToken, 1),
      embedding: round(plan.timings.embedding, 1),
      retrieval: round(plan.timings.retrieval, 1),
      filtering: round(plan.timings.filtering, 1),
      tool_calls: toolTotal > 0 ? round(toolTotal, 1) : null,
      generation: round(plan.timings.generation, 1),
    },
    spans,
  };

  const message: AssistantMessage = {
    id: context.messageId,
    conversation_id: context.conversationId,
    role: "assistant",
    created_at: context.now.toISOString(),
    content: plan.content,
    finish_reason: plan.finishReason,
    retrieval: finalRetrieval,
    tool_calls: plan.toolCalls,
    refusal: plan.refusal,
    metadata,
  };

  yield { type: "message.end", message };
}

/* -----------------------------------------------------------------------------------------------
 * Segments and tool placement
 * ---------------------------------------------------------------------------------------------*/

function splitIntoSegments(plan: ResponsePlan): Segment[] {
  const characters = [...plan.content];
  const calls = [...plan.toolCalls].sort(
    (a, b) => (a.content_offset ?? 0) - (b.content_offset ?? 0),
  );

  const segments: Segment[] = [];
  let cursor = 0;
  for (const call of calls) {
    const offset = clamp(call.content_offset ?? 0, cursor, characters.length);
    segments.push({ text: characters.slice(cursor, offset).join(""), toolCall: call });
    cursor = offset;
  }
  segments.push({ text: characters.slice(cursor).join(""), toolCall: null });

  // Drop a trailing empty segment, but keep an empty leading one: a tool call at offset 0 is valid
  // and means the model called the tool before saying anything.
  return segments.filter(
    (segment, index) => segment.text.length > 0 || segment.toolCall !== null || index === 0,
  );
}

/* -----------------------------------------------------------------------------------------------
 * Tokenisation and pacing
 * ---------------------------------------------------------------------------------------------*/

/**
 * Split text into token-sized pieces. Lossless: the concatenation always equals the input, which
 * the contract check asserts.
 */
export function tokenizeForStreaming(text: string, rng: Random): string[] {
  if (text.length === 0) return [];
  // Every character falls into exactly one of: newline run, other whitespace run, non-whitespace run.
  const pieces = text.match(/\n+|[^\S\n]+|\S+/g) ?? [];

  // Leading spaces belong with the word that follows, the way BPE tokenisers emit " word".
  const merged: string[] = [];
  for (let index = 0; index < pieces.length; index += 1) {
    const piece = pieces[index];
    const next = pieces[index + 1];
    const isBlankRun = /^[^\S\n]+$/.test(piece);
    if (isBlankRun && next !== undefined && /^\S+$/.test(next)) {
      merged.push(piece + next);
      index += 1;
    } else {
      merged.push(piece);
    }
  }

  const tokens: string[] = [];
  for (const word of merged) {
    if (/^\n+$/.test(word)) {
      tokens.push(word);
      continue;
    }
    let rest = word;
    // Markdown punctuation tends to arrive as its own token.
    const lead = /^([^\S\n]*)(\*\*|__|- |\* |#{1,3} |\| |> )/.exec(rest);
    if (lead) {
      tokens.push(lead[0]);
      rest = rest.slice(lead[0].length);
    }
    while (rest.length > 9) {
      const size = 3 + Math.floor(rng.next() * 3);
      tokens.push(rest.slice(0, size));
      rest = rest.slice(size);
    }
    if (rest.length > 0) tokens.push(rest);
  }
  return tokens;
}

interface PacedDelta {
  text: string;
  delayMs: number;
}

/** Group tokens into uneven bursts and spread `durationMs` across them. */
export function paceDeltas(
  tokens: string[],
  durationMs: number,
  rng: Random,
  profile: TimingProfile,
): PacedDelta[] {
  if (tokens.length === 0) return [];

  const bursts: string[] = [];
  for (let index = 0; index < tokens.length;) {
    const size = rng.weighted([
      [1, 34],
      [2, 24],
      [3, 16],
      [4, 10],
      [5, 7],
      [7, 5],
      [10, 4],
    ]);
    bursts.push(tokens.slice(index, index + size).join(""));
    index += size;
  }

  // The first burst arrives when prefill ends, so only the gaps between bursts consume the budget.
  const weights = bursts.map((burst, index) => {
    if (index === 0) return 0;
    const jitter = 0.55 + rng.next() * 1.0;
    const stalled = rng.chance(profile.stallChance) ? rng.range(profile.stallMultiplier) : 1;
    return Math.max(0.2, burst.length) * jitter * stalled;
  });

  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  return bursts.map((text, index) => ({
    text,
    delayMs: totalWeight === 0 ? 0 : (weights[index] / totalWeight) * durationMs,
  }));
}

/* -----------------------------------------------------------------------------------------------
 * Helpers
 * ---------------------------------------------------------------------------------------------*/

function findCitedRanks(content: string): number[] {
  const ranks: number[] = [];
  for (const match of content.matchAll(/\[(\d{1,2})\]/g)) {
    ranks.push(Number(match[1]));
  }
  return ranks;
}

/** Make `used_in_answer` true for exactly the ranks cited in the finished text. */
export function applyCitationUsage(retrieval: Retrieval | null, content: string): Retrieval | null {
  if (!retrieval) return null;
  const cited = new Set(findCitedRanks(content));
  return {
    ...retrieval,
    chunks: retrieval.chunks.map((chunk) => ({
      ...chunk,
      used_in_answer: cited.has(chunk.rank),
    })),
  };
}

function span(name: string, kind: Span["kind"], startMs: number, durationMs: number): Span {
  return { name, kind, start_ms: round(startMs, 1), duration_ms: round(durationMs, 1) };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
