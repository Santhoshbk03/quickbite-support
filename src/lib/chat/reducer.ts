/**
 * Pure event -> state reducer for one assistant turn. All stream semantics live here, so the store
 * only has to schedule and batch.
 */
import type { ChatStreamEvent, ToolCall } from "@/lib/api";
import type { AssistantTurn, ToolCallView, TurnSource } from "./types";

export function createAssistantTurn(args: {
  id: string;
  replyTo: string;
  source: TurnSource;
  createdAt: string;
}): AssistantTurn {
  return {
    id: args.id,
    role: "assistant",
    serverId: null,
    replyTo: args.replyTo,
    status: "pending",
    phase: null,
    phaseLabel: null,
    content: "",
    retrieval: null,
    citedRanks: [],
    toolCalls: [],
    refusal: null,
    finishReason: null,
    metadata: null,
    error: null,
    source: args.source,
    createdAt: args.createdAt,
    completedAt: null,
  };
}

/** The contract measures offsets in Unicode code points, not UTF-16 units. */
function codePointLength(text: string): number {
  return Array.from(text).length;
}

function toView(call: ToolCall, fallbackOffset: number): ToolCallView {
  return {
    id: call.id,
    name: call.name,
    arguments: call.arguments,
    contentOffset: call.content_offset ?? fallbackOffset,
    result: call,
  };
}

export function applyStreamEvent(turn: AssistantTurn, event: ChatStreamEvent): AssistantTurn {
  switch (event.type) {
    case "message.start":
      return { ...turn, serverId: event.message_id, status: "streaming" };

    case "status":
      return { ...turn, phase: event.phase, phaseLabel: event.label ?? null };

    case "retrieval":
      return { ...turn, retrieval: event.retrieval };

    case "message.delta":
      return { ...turn, content: turn.content + event.delta, status: "streaming" };

    case "citation":
      return turn.citedRanks.includes(event.rank)
        ? turn
        : { ...turn, citedRanks: [...turn.citedRanks, event.rank] };

    case "tool_call.start": {
      if (turn.toolCalls.some((call) => call.id === event.tool_call.id)) return turn;
      const view: ToolCallView = {
        id: event.tool_call.id,
        name: event.tool_call.name,
        arguments: event.tool_call.arguments,
        contentOffset: event.tool_call.content_offset ?? codePointLength(turn.content),
        result: null,
      };
      return { ...turn, toolCalls: [...turn.toolCalls, view] };
    }

    case "tool_call.result": {
      const existing = turn.toolCalls.find((call) => call.id === event.tool_call.id);
      const view = toView(
        event.tool_call,
        existing?.contentOffset ?? codePointLength(turn.content),
      );
      return {
        ...turn,
        toolCalls: existing
          ? turn.toolCalls.map((call) => (call.id === view.id ? view : call))
          : [...turn.toolCalls, view],
      };
    }

    case "refusal":
      return { ...turn, refusal: event.refusal };

    case "message.end": {
      const message = event.message;
      const toolCalls = message.tool_calls.map((call) => {
        const existing = turn.toolCalls.find((view) => view.id === call.id);
        return toView(call, existing?.contentOffset ?? 0);
      });
      const citedRanks = message.retrieval
        ? message.retrieval.chunks
            .filter((chunk) => chunk.used_in_answer)
            .map((chunk) => chunk.rank)
        : [];
      return {
        ...turn,
        serverId: message.id,
        status: "complete",
        phase: null,
        phaseLabel: null,
        // message.end is authoritative: the server may have post-processed the streamed text.
        content: message.content,
        retrieval: message.retrieval,
        citedRanks,
        toolCalls,
        refusal: message.refusal,
        finishReason: message.finish_reason,
        metadata: message.metadata ?? null,
        completedAt: new Date().toISOString(),
      };
    }

    case "error":
      return {
        ...turn,
        status: "error",
        phase: null,
        phaseLabel: null,
        error: event.error,
        completedAt: new Date().toISOString(),
      };
  }
}
