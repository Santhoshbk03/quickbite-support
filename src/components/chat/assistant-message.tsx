"use client";

import {
  Check,
  CircleAlert,
  Copy,
  RotateCcw,
  ScanSearch,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { memo } from "react";

import { LogoMark } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { ThinkingDots } from "@/components/ui/primitives";
import { useCopy } from "@/hooks/use-copy";
import { useIsDesktop } from "@/hooks/use-media-query";
import type { ApiErrorBody } from "@/lib/api";
import { useChatStore } from "@/lib/chat/store";
import type { AssistantTurn, ToolCallView } from "@/lib/chat/types";
import { isInFlight } from "@/lib/chat/types";
import { codePointOffsetToIndex, formatMs } from "@/lib/format";
import { useUiStore } from "@/lib/ui/store";
import { cn } from "@/lib/utils";
import { AnswerMarkdown } from "./answer-markdown";
import { RefusalCard } from "./refusal-card";
import { ToolCallCard } from "./tool-call-card";

type Segment =
  { kind: "text"; text: string; key: string } | { kind: "tool"; call: ToolCallView; key: string };

/** Split the answer around tool calls so each card sits where the model actually called it. */
function splitSegments(turn: AssistantTurn): Segment[] {
  const calls = [...turn.toolCalls].sort((a, b) => a.contentOffset - b.contentOffset);
  const segments: Segment[] = [];
  let cursor = 0;
  calls.forEach((call) => {
    const index = Math.max(cursor, codePointOffsetToIndex(turn.content, call.contentOffset));
    const before = turn.content.slice(cursor, index);
    if (before.trim()) segments.push({ kind: "text", text: before, key: `text-${cursor}` });
    segments.push({ kind: "tool", call, key: `tool-${call.id}` });
    cursor = index;
  });
  const rest = turn.content.slice(cursor);
  if (rest.trim()) segments.push({ kind: "text", text: rest, key: `text-${cursor}` });
  return segments;
}

const PHASE_COPY: Record<string, string> = {
  embedding: "Searching policy documents",
  retrieving: "Searching policy documents",
  filtering: "Checking the distance threshold",
  calling_tool: "Looking up your order",
  generating: "Writing an answer",
};

export function phaseCopy(turn: AssistantTurn): string {
  if (turn.phase) return PHASE_COPY[turn.phase] ?? turn.phaseLabel ?? "Thinking";
  return turn.status === "pending" ? "Connecting to support" : "Thinking";
}

export function friendlyError(error: ApiErrorBody): string {
  switch (error.code) {
    case "network_error":
      return "Couldn’t reach the support service.";
    case "stream_interrupted":
      return "The connection dropped before the answer finished. What arrived is kept above.";
    case "rate_limited":
      return `Too many requests right now.${error.retry_after_ms ? ` Try again in ${Math.ceil(error.retry_after_ms / 1000)} seconds.` : ""}`;
    case "timeout":
      return "The backend took too long to respond. It may be waking up.";
    case "upstream_unavailable":
      return "The language model is unavailable right now.";
    case "contract_violation":
      return "The response didn’t match the expected format.";
    default:
      return error.message || "Something went wrong.";
  }
}

function plainText(content: string): string {
  return content.replace(/\s?\[\d{1,2}\]/g, "").trim();
}

export const AssistantMessage = memo(function AssistantMessage({
  turn,
  isLast,
}: {
  turn: AssistantTurn;
  isLast: boolean;
}) {
  const inFlight = isInFlight(turn);
  const streaming = turn.status === "streaming";
  const hasBody = turn.content.length > 0 || turn.toolCalls.length > 0;
  const segments = turn.refusal ? [] : splitSegments(turn);
  const referenceTime = turn.completedAt ?? turn.createdAt;

  return (
    <article aria-label="QuickBite’s answer" className="group/turn relative" aria-busy={inFlight}>
      <TurnHeader turn={turn} />

      {turn.refusal ? (
        <RefusalCard turn={turn} />
      ) : (
        <div className="flex flex-col gap-4">
          {segments.map((segment) =>
            segment.kind === "text" ? (
              <AnswerMarkdown
                key={segment.key}
                text={segment.text}
                retrieval={turn.retrieval}
                turnId={turn.id}
                streaming={streaming}
              />
            ) : (
              <ToolCallCard key={segment.key} call={segment.call} referenceTime={referenceTime} />
            ),
          )}
        </div>
      )}

      {inFlight ? (
        <div
          className={cn(
            "flex h-8 items-center gap-2.5 text-[0.8125rem] text-fg-subtle",
            hasBody && "mt-2",
          )}
        >
          <ThinkingDots />
          <span>{phaseCopy(turn)}</span>
          {turn.retrieval && !hasBody ? (
            <span className="font-mono text-2xs tabular">
              · {turn.retrieval.chunks.filter((chunk) => chunk.passed_threshold).length}/
              {turn.retrieval.chunks.length} chunks cleared
            </span>
          ) : null}
        </div>
      ) : null}

      {turn.status === "error" && turn.error ? (
        <ErrorNotice turn={turn} error={turn.error} isLast={isLast} />
      ) : null}

      {turn.status === "stopped" ? (
        <p className="mt-2 text-xs text-fg-subtle">
          {hasBody ? "Stopped before the answer finished." : "Stopped before an answer started."}
        </p>
      ) : null}

      {!inFlight && (hasBody || turn.refusal) ? <TurnActions turn={turn} isLast={isLast} /> : null}
      {!inFlight && !hasBody && !turn.refusal && turn.status === "stopped" && isLast ? (
        <TurnActions turn={turn} isLast={isLast} />
      ) : null}
    </article>
  );
});

function TurnHeader({ turn }: { turn: AssistantTurn }) {
  const isDesktop = useIsDesktop();
  const inspectTurn = useUiStore((state) => state.inspectTurn);
  const chunks = turn.retrieval?.chunks ?? [];
  const cited = chunks.filter(
    (chunk) => chunk.used_in_answer || turn.citedRanks.includes(chunk.rank),
  ).length;
  const total = turn.metadata?.latency_ms?.total;
  const model = turn.metadata?.model;

  return (
    <div className="mb-2.5 flex min-h-6 flex-wrap items-center gap-x-2 gap-y-1">
      <LogoMark className="size-5" />
      <span className="text-[0.8125rem] font-medium text-fg">QuickBite</span>
      {turn.source === "replay" ? (
        <Badge tone="brand" size="sm">
          Recorded
        </Badge>
      ) : null}
      {model?.fallback_used ? (
        <Badge tone="neutral" size="sm" title={model.fallback_reason ?? undefined}>
          Fallback · {model.name}
        </Badge>
      ) : null}
      {turn.status === "complete" && (chunks.length > 0 || total) ? (
        <button
          type="button"
          onClick={() => inspectTurn(turn.id, isDesktop)}
          className="ml-auto inline-flex items-center gap-2 rounded-xs px-1.5 py-0.5 font-mono text-2xs tabular text-fg-subtle transition-colors hover:bg-surface-3 hover:text-fg-muted focus-visible:ring-2 focus-visible:ring-ring"
        >
          {chunks.length > 0 ? (
            <span>
              {turn.refusal
                ? `0/${chunks.length} cleared`
                : `${cited} of ${chunks.length} sources cited`}
            </span>
          ) : null}
          {total ? (
            <>
              <span aria-hidden className="text-line-strong">
                ·
              </span>
              <span>{formatMs(total)}</span>
            </>
          ) : null}
        </button>
      ) : null}
    </div>
  );
}

function ErrorNotice({
  turn,
  error,
  isLast,
}: {
  turn: AssistantTurn;
  error: ApiErrorBody;
  isLast: boolean;
}) {
  const regenerate = useChatStore((state) => state.regenerate);
  const busy = useChatStore((state) => state.streamingTurnId !== null);
  return (
    <div
      role="alert"
      className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-[color-mix(in_oklab,var(--danger)_28%,transparent)] bg-danger-soft px-3.5 py-2.5"
    >
      <CircleAlert className="size-4 shrink-0 text-danger" aria-hidden />
      <p className="min-w-0 flex-1 text-[0.8125rem] text-fg">
        {friendlyError(error)}
        <span className="ml-2 font-mono text-2xs text-fg-subtle">
          {error.code}
          {error.request_id ? ` · ${error.request_id}` : ""}
        </span>
      </p>
      {isLast ? (
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => void regenerate(turn.id)}
        >
          <RotateCcw aria-hidden />
          Try again
        </Button>
      ) : null}
    </div>
  );
}

function TurnActions({ turn, isLast }: { turn: AssistantTurn; isLast: boolean }) {
  const { copied, copy } = useCopy();
  const isDesktop = useIsDesktop();
  const feedback = useChatStore((state) => state.feedback[turn.id] ?? null);
  const setFeedback = useChatStore((state) => state.setFeedback);
  const regenerate = useChatStore((state) => state.regenerate);
  const busy = useChatStore(
    (state) => state.streamingTurnId !== null || state.replayingId !== null,
  );
  const inspectTurn = useUiStore((state) => state.inspectTurn);
  const text = plainText(turn.refusal ? turn.refusal.message : turn.content);

  return (
    <div className="mt-2 flex h-8 items-center gap-0.5 text-fg-subtle">
      {text ? (
        <IconButton
          label={copied ? "Copied" : "Copy answer"}
          icon={copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          tooltipSide="top"
          onClick={() => void copy(text)}
        />
      ) : null}
      {isLast ? (
        <IconButton
          label="Regenerate"
          icon={<RotateCcw aria-hidden />}
          tooltipSide="top"
          disabled={busy}
          onClick={() => void regenerate(turn.id)}
        />
      ) : null}
      {turn.status === "complete" ? (
        <>
          <IconButton
            label="Helpful"
            icon={<ThumbsUp aria-hidden fill={feedback === "up" ? "currentColor" : "none"} />}
            tooltipSide="top"
            aria-pressed={feedback === "up"}
            className={feedback === "up" ? "text-brand-ink" : undefined}
            onClick={() => setFeedback(turn.id, feedback === "up" ? null : "up")}
          />
          <IconButton
            label="Not helpful"
            icon={<ThumbsDown aria-hidden fill={feedback === "down" ? "currentColor" : "none"} />}
            tooltipSide="top"
            aria-pressed={feedback === "down"}
            className={feedback === "down" ? "text-brand-ink" : undefined}
            onClick={() => setFeedback(turn.id, feedback === "down" ? null : "down")}
          />
          <span aria-hidden className="mx-1.5 h-4 w-px bg-line" />
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-2 text-xs"
            onClick={() => inspectTurn(turn.id, isDesktop)}
          >
            <ScanSearch aria-hidden />
            Inspect
          </Button>
        </>
      ) : null}
    </div>
  );
}
