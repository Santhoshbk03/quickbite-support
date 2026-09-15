import type {
  ApiErrorBody,
  FeedbackValue,
  FinishReason,
  PipelinePhase,
  Refusal,
  ResponseMetadata,
  Retrieval,
  ToolCall,
} from "@/lib/api";

export type TurnStatus = "pending" | "streaming" | "complete" | "error" | "stopped";

/** Which source actually produced an answer. "replay" means the live backend was unreachable. */
export type TurnSource = "mock" | "live" | "replay";

export interface UserTurn {
  id: string;
  role: "user";
  content: string;
  createdAt: string;
}

export interface ToolCallView {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  /** Offset into `content`, in Unicode code points. */
  contentOffset: number;
  /** Null while the tool is still running. */
  result: ToolCall | null;
}

export interface AssistantTurn {
  /** Client-generated and stable, so React keys never change mid-stream. */
  id: string;
  role: "assistant";
  /** message_id assigned by the backend in message.start. */
  serverId: string | null;
  replyTo: string;
  status: TurnStatus;
  phase: PipelinePhase | null;
  phaseLabel: string | null;
  content: string;
  retrieval: Retrieval | null;
  /** Ranks cited so far; final values come from used_in_answer at message.end. */
  citedRanks: number[];
  toolCalls: ToolCallView[];
  refusal: Refusal | null;
  finishReason: FinishReason | null;
  metadata: ResponseMetadata | null;
  error: ApiErrorBody | null;
  source: TurnSource;
  createdAt: string;
  completedAt: string | null;
}

export type ChatTurn = UserTurn | AssistantTurn;

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  turns: ChatTurn[];
  /** Set when this conversation is a replay of a scripted session. */
  replayOf: string | null;
}

export type FeedbackMap = Record<string, FeedbackValue>;

export function isAssistantTurn(turn: ChatTurn): turn is AssistantTurn {
  return turn.role === "assistant";
}

export function isInFlight(turn: AssistantTurn): boolean {
  return turn.status === "pending" || turn.status === "streaming";
}
