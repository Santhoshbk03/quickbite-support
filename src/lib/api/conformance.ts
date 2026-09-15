/**
 * Runtime check of the stream grammar in API_CONTRACT.md §1.5.
 *
 * The schemas validate each event in isolation; this validates the sequence. It runs under
 * `pnpm contract:check` against both the mock and a real backend, so "is my backend wired
 * correctly?" has a mechanical answer instead of a manual read-through.
 */
import { isLookupOrderCall } from "./schemas";
import type { ChatStreamEvent, Retrieval } from "./schemas";

export interface ConformanceIssue {
  severity: "error" | "warning";
  /** Stable identifier, e.g. `terminal.missing`. */
  code: string;
  message: string;
  /** Index in the event array, when the issue is tied to one event. */
  index?: number;
}

type AddIssue = (
  severity: ConformanceIssue["severity"],
  code: string,
  message: string,
  index?: number,
) => void;

export function checkEventSequence(events: ChatStreamEvent[]): ConformanceIssue[] {
  const issues: ConformanceIssue[] = [];
  const add: AddIssue = (severity, code, message, index) => {
    issues.push(
      index === undefined ? { severity, code, message } : { severity, code, message, index },
    );
  };

  if (events.length === 0) {
    add("error", "stream.empty", "The stream produced no events.");
    return issues;
  }

  const first = events[0];
  if (first.type !== "message.start") {
    add("error", "start.missing", `First event must be message.start, got ${first.type}.`, 0);
  }

  const messageId = first.type === "message.start" ? first.message_id : null;
  let terminalIndex = -1;
  let retrievalIndex = -1;
  let refusalIndex = -1;
  let firstDeltaIndex = -1;
  let firstMarkerIndex = -1;
  let streamedContent = "";
  const ranks = new Map<number, { chunkId: string; passed: boolean }>();
  const openToolCalls = new Set<string>();
  const seenToolCallIds = new Set<string>();
  const resolvedToolCalls: string[] = [];

  events.forEach((event, index) => {
    if (terminalIndex !== -1) {
      add("error", "terminal.trailing", `${event.type} arrived after the terminal event.`, index);
      return;
    }
    if (index > 0 && event.type === "message.start") {
      add("error", "start.duplicate", "message.start may only be the first event.", index);
    }

    switch (event.type) {
      case "retrieval": {
        if (retrievalIndex !== -1) {
          add("error", "retrieval.duplicate", "retrieval may be sent at most once.", index);
        }
        retrievalIndex = index;
        if (firstDeltaIndex !== -1) {
          add(
            "warning",
            "retrieval.late",
            "retrieval should precede the first message.delta so citations can render immediately.",
            index,
          );
        }
        if (firstMarkerIndex !== -1) {
          add(
            "error",
            "retrieval.after_marker",
            "retrieval must precede any delta containing a citation marker.",
            index,
          );
        }
        const chunks = event.retrieval.chunks;
        const threshold = event.retrieval.threshold;
        if (chunks.length > event.retrieval.top_k) {
          add(
            "warning",
            "retrieval.over_top_k",
            `${chunks.length} chunks returned for top_k=${event.retrieval.top_k}.`,
            index,
          );
        }
        chunks.forEach((chunk, position) => {
          if (chunk.rank !== position + 1) {
            add(
              "error",
              "retrieval.rank_order",
              `chunks must be sorted by rank ascending from 1; position ${position} has rank ${chunk.rank}.`,
              index,
            );
          }
          if (chunk.passed_threshold !== chunk.distance <= threshold) {
            add(
              "error",
              "retrieval.threshold_mismatch",
              `chunk ${chunk.id}: passed_threshold=${chunk.passed_threshold} but distance ${chunk.distance} against threshold ${threshold}.`,
              index,
            );
          }
          if (chunk.used_in_answer) {
            add(
              "warning",
              "retrieval.premature_used",
              `chunk ${chunk.id} is already marked used_in_answer; usage is only known at message.end.`,
              index,
            );
          }
          ranks.set(chunk.rank, { chunkId: chunk.id, passed: chunk.passed_threshold });
        });
        break;
      }

      case "message.delta": {
        if (firstDeltaIndex === -1) firstDeltaIndex = index;
        streamedContent += event.delta;
        if (firstMarkerIndex === -1 && /\[\d{1,2}\]/.test(streamedContent))
          firstMarkerIndex = index;
        break;
      }

      case "citation": {
        if (retrievalIndex === -1) {
          add(
            "error",
            "citation.before_retrieval",
            "citation events must follow the retrieval event.",
            index,
          );
          break;
        }
        const target = ranks.get(event.rank);
        if (!target) {
          add(
            "error",
            "citation.unknown_rank",
            `citation references rank ${event.rank}, which was not retrieved.`,
            index,
          );
        } else if (target.chunkId !== event.chunk_id) {
          add(
            "error",
            "citation.chunk_mismatch",
            `citation rank ${event.rank} names chunk ${event.chunk_id}; retrieval says ${target.chunkId}.`,
            index,
          );
        } else if (!target.passed) {
          add(
            "error",
            "citation.below_threshold",
            `citation references rank ${event.rank}, which did not pass the threshold.`,
            index,
          );
        }
        break;
      }

      case "tool_call.start": {
        if (refusalIndex !== -1) {
          add(
            "error",
            "refusal.with_tools",
            "A refusal response must not contain tool calls.",
            index,
          );
        }
        if (seenToolCallIds.has(event.tool_call.id)) {
          add(
            "error",
            "tool.duplicate_id",
            `tool_call id ${event.tool_call.id} was already used.`,
            index,
          );
        }
        if (openToolCalls.size > 0) {
          add(
            "error",
            "tool.overlapping",
            "v1 tool calls are sequential, but the previous call has no result yet.",
            index,
          );
        }
        seenToolCallIds.add(event.tool_call.id);
        openToolCalls.add(event.tool_call.id);
        break;
      }

      case "tool_call.result": {
        if (!openToolCalls.delete(event.tool_call.id)) {
          add(
            "error",
            "tool.unmatched_result",
            `tool_call.result for ${event.tool_call.id} has no matching tool_call.start.`,
            index,
          );
        }
        resolvedToolCalls.push(event.tool_call.id);
        break;
      }

      case "refusal": {
        if (refusalIndex !== -1) {
          add("error", "refusal.duplicate", "refusal may be sent at most once.", index);
        }
        refusalIndex = index;
        if (seenToolCallIds.size > 0) {
          add(
            "error",
            "refusal.with_tools",
            "A refusal response must not contain tool calls.",
            index,
          );
        }
        if (event.refusal.reason === "below_threshold" && retrievalIndex !== -1) {
          const retrievalEvent = events[retrievalIndex];
          if (
            retrievalEvent.type === "retrieval" &&
            retrievalEvent.retrieval.chunks.some((chunk) => chunk.passed_threshold)
          ) {
            add(
              "error",
              "refusal.contradicts_retrieval",
              "below_threshold refusal, but a retrieved chunk passed the threshold.",
              index,
            );
          }
        }
        break;
      }

      case "message.end": {
        terminalIndex = index;
        const message = event.message;
        if (messageId !== null && message.id !== messageId) {
          add(
            "error",
            "end.id_mismatch",
            `message.end id ${message.id} does not match message.start ${messageId}.`,
            index,
          );
        }
        if (openToolCalls.size > 0) {
          add(
            "error",
            "tool.unresolved",
            `tool call(s) ${[...openToolCalls].join(", ")} never produced a result.`,
            index,
          );
        }
        if (streamedContent !== "" && streamedContent !== message.content) {
          add(
            "warning",
            "end.content_mismatch",
            "Concatenated deltas differ from message.end content; the client will swap in the final text.",
            index,
          );
        }
        if ((message.refusal !== null) !== (refusalIndex !== -1)) {
          add(
            "error",
            "end.refusal_mismatch",
            "message.end.refusal must be set exactly when a refusal event was sent.",
            index,
          );
        }
        if ((message.finish_reason === "refusal") !== (message.refusal !== null)) {
          add(
            "error",
            "end.finish_reason",
            `finish_reason "${message.finish_reason}" is inconsistent with refusal=${message.refusal !== null}.`,
            index,
          );
        }
        if (message.tool_calls.length !== resolvedToolCalls.length) {
          add(
            "warning",
            "end.tool_calls_count",
            `message.end lists ${message.tool_calls.length} tool call(s); the stream resolved ${resolvedToolCalls.length}.`,
            index,
          );
        }
        message.tool_calls.forEach((call) => {
          if (!seenToolCallIds.has(call.id)) {
            add(
              "error",
              "end.unknown_tool_call",
              `message.end lists tool call ${call.id}, which was never streamed.`,
              index,
            );
          }
          if (isLookupOrderCall(call) && call.status === "success" && call.result) {
            const order = call.result;
            if (order.status === "delivered" && !order.timestamps.delivered_at) {
              add(
                "warning",
                "tool.delivered_without_time",
                `lookup_order(${order.order_id}) is delivered but has no timestamps.delivered_at, so the card cannot show when.`,
                index,
              );
            }
            if (order.status === "cancelled" && !order.cancellation) {
              add(
                "warning",
                "tool.cancelled_without_details",
                `lookup_order(${order.order_id}) is cancelled but carries no cancellation details.`,
                index,
              );
            }
          }
        });
        checkFinalUsage(message.content, message.retrieval, add, index);
        break;
      }

      case "error": {
        terminalIndex = index;
        break;
      }

      case "message.start":
      case "status":
        break;
    }
  });

  if (terminalIndex === -1) {
    add("error", "terminal.missing", "The stream ended without message.end or error.");
  }

  return issues;
}

function checkFinalUsage(
  content: string,
  retrieval: Retrieval | null,
  add: AddIssue,
  index: number,
): void {
  if (!retrieval) return;
  const cited = new Set<number>();
  for (const match of content.matchAll(/\[(\d{1,2})\]/g)) {
    cited.add(Number(match[1]));
  }
  for (const chunk of retrieval.chunks) {
    const isCited = cited.has(chunk.rank);
    if (chunk.used_in_answer !== isCited) {
      add(
        "error",
        "end.used_in_answer",
        `chunk ${chunk.id} (rank ${chunk.rank}): used_in_answer=${chunk.used_in_answer} but it ${
          isCited ? "is" : "is not"
        } cited in the final content.`,
        index,
      );
    }
    if (chunk.used_in_answer && !chunk.passed_threshold) {
      add(
        "error",
        "end.used_below_threshold",
        `chunk ${chunk.id} is marked used_in_answer but did not pass the threshold.`,
        index,
      );
    }
  }
  for (const rank of cited) {
    if (!retrieval.chunks.some((chunk) => chunk.rank === rank)) {
      add(
        "warning",
        "end.dangling_marker",
        `Final content cites [${rank}], which is not in retrieval.chunks. Strip invalid markers server-side.`,
        index,
      );
    }
  }
}

export function formatConformanceIssues(issues: ConformanceIssue[]): string {
  return issues
    .map((issue) => {
      const at = issue.index === undefined ? "" : ` (event #${issue.index})`;
      const marker = issue.severity === "error" ? "x" : "!";
      return `  ${marker} [${issue.code}]${at} ${issue.message}`;
    })
    .join("\n");
}
