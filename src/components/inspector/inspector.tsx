"use client";

import {
  ChevronLeft,
  ChevronRight,
  Coins,
  ExternalLink,
  Radar,
  ScanSearch,
  Timer,
  Waypoints,
  Wrench,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/icon-button";
import { Skeleton } from "@/components/ui/primitives";
import { useCopy } from "@/hooks/use-copy";
import { useIsDesktop } from "@/hooks/use-media-query";
import { buildTraceUrl, getApiConfig } from "@/lib/api";
import type { ResponseMetadata, SourceChunk, Span } from "@/lib/api";
import { useActiveConversation } from "@/lib/chat/store";
import type { AssistantTurn, Conversation } from "@/lib/chat/types";
import { isAssistantTurn, isInFlight } from "@/lib/chat/types";
import { formatDistance, formatMs, formatTokens, formatUsd, truncate } from "@/lib/format";
import { useUiStore } from "@/lib/ui/store";
import { cn } from "@/lib/utils";
import { DistanceScale, markState } from "./distance-scale";

export function resolveInspectedTurn(
  conversation: Conversation | null,
  turnId: string | null,
): AssistantTurn | null {
  if (!conversation) return null;
  const assistants = conversation.turns.filter(isAssistantTurn);
  return assistants.find((turn) => turn.id === turnId) ?? assistants.at(-1) ?? null;
}

export function Inspector() {
  const conversation = useActiveConversation();
  const inspectedId = useUiStore((state) => state.inspectedTurnId);
  const closeInspector = useUiStore((state) => state.closeInspector);
  const turn = resolveInspectedTurn(conversation, inspectedId);

  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface-1 px-4">
        <ScanSearch className="size-4 text-brand-ink" aria-hidden />
        <h2 className="text-sm font-medium text-fg">Inspector</h2>
        {conversation && turn ? <TurnPicker conversation={conversation} turn={turn} /> : null}
        <IconButton
          label="Close inspector"
          icon={<X aria-hidden />}
          className="ml-auto"
          onClick={closeInspector}
        />
      </div>

      {!turn || !conversation ? (
        <InspectorEmpty />
      ) : (
        <InspectorBody conversation={conversation} turn={turn} />
      )}
    </div>
  );
}

function InspectorEmpty() {
  return (
    <div className="flex flex-1 flex-col gap-6 px-5 py-6">
      <div>
        <p className="font-display-tight text-lg font-medium text-fg">Every answer, taken apart</p>
        <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-fg-subtle">
          Ask a question and this panel shows what was retrieved and how close it was, which chunks
          the answer actually cited, where the milliseconds went, and what it cost.
        </p>
      </div>
      <ul className="flex flex-col gap-3 text-[0.8125rem] text-fg-muted">
        {[
          { icon: <Radar aria-hidden />, text: "Ranked chunks against the refusal threshold" },
          { icon: <Timer aria-hidden />, text: "Embed → retrieve → filter → generate waterfall" },
          { icon: <Coins aria-hidden />, text: "Model, parameters, tokens, and estimated cost" },
          { icon: <Waypoints aria-hidden />, text: "The Langfuse trace for that exact response" },
        ].map((item) => (
          <li key={item.text} className="flex items-center gap-3">
            <span className="flex size-7 items-center justify-center rounded-sm border border-line bg-surface-2 text-fg-subtle [&_svg]:size-3.5">
              {item.icon}
            </span>
            {item.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TurnPicker({ conversation, turn }: { conversation: Conversation; turn: AssistantTurn }) {
  const isDesktop = useIsDesktop();
  const inspectTurn = useUiStore((state) => state.inspectTurn);
  const assistants = conversation.turns.filter(isAssistantTurn);
  const index = assistants.findIndex((candidate) => candidate.id === turn.id);
  if (assistants.length < 2) return null;

  return (
    <div className="ml-2 flex items-center gap-0.5 text-2xs text-fg-subtle">
      <IconButton
        label="Previous answer"
        icon={<ChevronLeft aria-hidden />}
        className="size-7"
        disabled={index <= 0}
        onClick={() => inspectTurn(assistants[index - 1].id, isDesktop)}
      />
      <span className="font-mono tabular" aria-live="polite">
        {index + 1}/{assistants.length}
      </span>
      <IconButton
        label="Next answer"
        icon={<ChevronRight aria-hidden />}
        className="size-7"
        disabled={index >= assistants.length - 1}
        onClick={() => inspectTurn(assistants[index + 1].id, isDesktop)}
      />
    </div>
  );
}

function InspectorBody({
  conversation,
  turn,
}: {
  conversation: Conversation;
  turn: AssistantTurn;
}) {
  const question = conversation.turns.find((candidate) => candidate.id === turn.replyTo);
  const inFlight = isInFlight(turn);

  return (
    <div className="flex flex-col">
      <div className="border-b border-line px-5 py-4">
        <p className="eyebrow">Answer to</p>
        <p className="mt-1 line-clamp-3 text-[0.8125rem] leading-relaxed text-fg">
          {question && question.role === "user" ? `“${question.content}”` : "—"}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <StatusBadge turn={turn} />
          {turn.source === "replay" ? (
            <Badge tone="brand" size="sm">
              Replayed from fixtures
            </Badge>
          ) : null}
        </div>
      </div>

      <RetrievalSection turn={turn} inFlight={inFlight} />
      <PipelineSection metadata={turn.metadata} inFlight={inFlight} />
      <ModelSection turn={turn} inFlight={inFlight} />
      {turn.toolCalls.length > 0 ? <ToolsSection turn={turn} /> : null}
      <TraceSection metadata={turn.metadata} />
    </div>
  );
}

function StatusBadge({ turn }: { turn: AssistantTurn }) {
  if (turn.status === "complete") {
    return turn.refusal ? (
      <Badge tone="brand" size="sm">
        Refused · below threshold
      </Badge>
    ) : (
      <Badge tone="success" size="sm">
        Answered
      </Badge>
    );
  }
  if (turn.status === "error")
    return (
      <Badge tone="danger" size="sm">
        Failed · {turn.error?.code}
      </Badge>
    );
  if (turn.status === "stopped") return <Badge size="sm">Stopped</Badge>;
  return <Badge size="sm">Streaming</Badge>;
}

function Section({
  title,
  icon,
  meta,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  meta?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-line px-5 py-5 last:border-b-0" aria-label={title}>
      <div className="mb-3.5 flex items-center gap-2">
        <span className="text-fg-subtle [&_svg]:size-3.5">{icon}</span>
        <h3 className="text-[0.8125rem] font-medium text-fg">{title}</h3>
        {meta ? (
          <span className="ml-auto font-mono text-2xs tabular text-fg-subtle">{meta}</span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/* Retrieval ------------------------------------------------------------------------------------*/

function RetrievalSection({ turn, inFlight }: { turn: AssistantTurn; inFlight: boolean }) {
  const isDesktop = useIsDesktop();
  const openSource = useUiStore((state) => state.openSource);
  const retrieval = turn.retrieval;

  if (!retrieval) {
    if (!inFlight) {
      return turn.status === "complete" ? (
        <Section title="Retrieval" icon={<Radar aria-hidden />}>
          <p className="text-[0.8125rem] text-fg-subtle">Retrieval was skipped for this message.</p>
        </Section>
      ) : null;
    }
    return (
      <Section title="Retrieval" icon={<Radar aria-hidden />}>
        <div className="flex flex-col gap-2" aria-hidden>
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      </Section>
    );
  }

  const withUsage = retrieval.chunks.map((chunk) => ({
    ...chunk,
    used_in_answer: chunk.used_in_answer || turn.citedRanks.includes(chunk.rank),
  }));
  const passed = withUsage.filter((chunk) => chunk.passed_threshold).length;
  const cited = withUsage.filter((chunk) => chunk.used_in_answer).length;

  return (
    <Section
      title="Retrieval"
      icon={<Radar aria-hidden />}
      meta={`top-k ${retrieval.top_k} · ${retrieval.distance_metric}`}
    >
      <div className="mb-3 flex flex-wrap gap-1.5">
        <Badge size="sm">{retrieval.chunks.length} retrieved</Badge>
        <Badge size="sm" tone={passed > 0 ? "brand" : "neutral"}>
          {passed} cleared ≤ {formatDistance(retrieval.threshold)}
        </Badge>
        <Badge size="sm" tone={cited > 0 ? "success" : "neutral"}>
          {cited} cited
        </Badge>
      </div>

      <div className="mb-4 rounded-sm border border-line bg-sunken px-3 py-2.5 text-xs">
        <p className="text-fg-subtle">{retrieval.standalone_query ? "Asked" : "Embedded query"}</p>
        <p className="mt-0.5 leading-relaxed text-fg-muted">{truncate(retrieval.query, 220)}</p>
        {retrieval.standalone_query ? (
          <>
            <p className="mt-2 text-fg-subtle">Rewritten for retrieval (follow-up → standalone)</p>
            <p className="mt-0.5 leading-relaxed text-fg">
              {truncate(retrieval.standalone_query, 260)}
            </p>
          </>
        ) : null}
        {retrieval.embedding_model ? (
          <p className="mt-2 font-mono text-2xs text-fg-subtle">{retrieval.embedding_model}</p>
        ) : null}
      </div>

      {withUsage.length ? (
        <DistanceScale
          className="mb-4"
          threshold={retrieval.threshold}
          metric={retrieval.distance_metric}
          marks={withUsage.map((chunk) => ({
            id: chunk.id,
            distance: chunk.distance,
            label: `#${chunk.rank} ${chunk.document.title}`,
            state: markState(chunk),
          }))}
        />
      ) : null}

      <ol className="flex flex-col gap-2">
        {withUsage.map((chunk) => (
          <li key={chunk.id}>
            <ChunkRow
              chunk={chunk}
              onOpen={() => openSource({ turnId: turn.id, rank: chunk.rank }, isDesktop)}
            />
          </li>
        ))}
      </ol>
    </Section>
  );
}

function ChunkRow({ chunk, onOpen }: { chunk: SourceChunk; onOpen: () => void }) {
  const state = markState(chunk);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group flex w-full items-start gap-3 rounded-md border p-3 text-left transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring",
        state === "cited" && "border-brand-line bg-brand-soft hover:border-brand",
        state === "passed" && "border-line bg-surface-2 hover:border-line-strong",
        state === "rejected" &&
          "border-dashed border-line-strong bg-transparent hover:bg-surface-2",
      )}
    >
      <span
        className={cn(
          "mt-px font-mono text-xs tabular",
          state === "cited" ? "text-brand-ink" : "text-fg-subtle",
        )}
      >
        #{chunk.rank}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-[0.8125rem] font-medium",
            state === "rejected" ? "text-fg-muted" : "text-fg",
          )}
        >
          {chunk.document.title}
        </span>
        {chunk.document.section ? (
          <span className="block truncate text-2xs text-fg-subtle">{chunk.document.section}</span>
        ) : null}
        <span className="mt-1.5 line-clamp-2 block text-2xs leading-relaxed text-fg-subtle">
          {chunk.text}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="font-mono text-xs tabular text-fg">{formatDistance(chunk.distance)}</span>
        {state === "cited" ? (
          <Badge tone="brand" size="sm">
            Cited
          </Badge>
        ) : state === "passed" ? (
          <Badge size="sm">Unused</Badge>
        ) : (
          <Badge tone="outline" size="sm">
            Below
          </Badge>
        )}
      </span>
    </button>
  );
}

/* Pipeline -------------------------------------------------------------------------------------*/

const SPAN_STYLE: Record<Span["kind"], { bar: string; label: string }> = {
  embedding: { bar: "bg-info", label: "Embed" },
  retrieval: { bar: "bg-info/60", label: "Retrieve" },
  filtering: { bar: "bg-fg-subtle", label: "Filter" },
  tool: { bar: "bg-success", label: "Tool" },
  generation: { bar: "bg-brand", label: "Generate" },
  other: { bar: "bg-line-strong", label: "Other" },
};

function synthesizeSpans(metadata: ResponseMetadata): Span[] {
  const latency = metadata.latency_ms;
  if (!latency) return [];
  const order: [Span["kind"], string, number | null | undefined][] = [
    ["embedding", "embedding", latency.embedding],
    ["retrieval", "retrieval", latency.retrieval],
    ["filtering", "filtering", latency.filtering],
    ["tool", "tool_calls", latency.tool_calls],
    ["generation", "generation", latency.generation],
  ];
  let cursor = Math.max(
    0,
    latency.total - order.reduce((sum, [, , value]) => sum + (value ?? 0), 0),
  );
  const spans: Span[] = [];
  for (const [kind, name, value] of order) {
    if (!value) continue;
    spans.push({ name, kind, start_ms: cursor, duration_ms: value });
    cursor += value;
  }
  return spans;
}

function PipelineSection({
  metadata,
  inFlight,
}: {
  metadata: ResponseMetadata | null;
  inFlight: boolean;
}) {
  if (!metadata?.latency_ms) {
    return inFlight ? (
      <Section title="Pipeline" icon={<Timer aria-hidden />}>
        <div className="flex flex-col gap-2" aria-hidden>
          {[40, 62, 30, 88].map((width) => (
            <Skeleton key={width} className="h-3" style={{ width: `${width}%` }} />
          ))}
        </div>
      </Section>
    ) : null;
  }

  const latency = metadata.latency_ms;
  const spans = metadata.spans?.length ? metadata.spans : synthesizeSpans(metadata);
  const total = Math.max(
    latency.total,
    ...spans.map((span) => span.start_ms + span.duration_ms),
    1,
  );
  const kinds = [...new Set(spans.map((span) => span.kind))];

  return (
    <Section
      title="Pipeline"
      icon={<Timer aria-hidden />}
      meta={`total ${formatMs(latency.total)}`}
    >
      <ol className="flex flex-col gap-1.5" aria-label="Latency waterfall">
        {spans.map((span, index) => {
          const style = SPAN_STYLE[span.kind];
          return (
            <li
              key={`${span.name}-${index}`}
              className="grid grid-cols-[4.5rem_minmax(0,1fr)_3.75rem] items-center gap-2.5"
            >
              <span className="truncate font-mono text-2xs text-fg-subtle" title={span.name}>
                {style.label}
              </span>
              <span className="relative h-2.5 rounded-full bg-surface-3">
                <span
                  className={cn("absolute inset-y-0 rounded-full", style.bar)}
                  style={{
                    left: `${(span.start_ms / total) * 100}%`,
                    width: `max(3px, ${(span.duration_ms / total) * 100}%)`,
                  }}
                />
              </span>
              <span className="text-right font-mono text-2xs tabular text-fg-muted">
                {formatMs(span.duration_ms)}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {kinds.map((kind) => (
          <span key={kind} className="inline-flex items-center gap-1.5 text-2xs text-fg-subtle">
            <span className={cn("size-2 rounded-full", SPAN_STYLE[kind].bar)} aria-hidden />
            {SPAN_STYLE[kind].label}
          </span>
        ))}
        {latency.time_to_first_token != null ? (
          <span className="ml-auto font-mono text-2xs tabular text-fg-subtle">
            TTFT {formatMs(latency.time_to_first_token)}
          </span>
        ) : null}
      </div>
    </Section>
  );
}

/* Model ----------------------------------------------------------------------------------------*/

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="min-w-0 rounded-sm border border-line bg-surface-2 px-3 py-2">
      <dt className="text-2xs text-fg-subtle">{label}</dt>
      <dd className="mt-0.5 truncate font-mono text-[0.8125rem] tabular text-fg" title={hint}>
        {value}
      </dd>
    </div>
  );
}

function ModelSection({ turn, inFlight }: { turn: AssistantTurn; inFlight: boolean }) {
  const metadata = turn.metadata;
  if (!metadata) {
    return inFlight ? (
      <Section title="Model & cost" icon={<Coins aria-hidden />}>
        <div className="grid grid-cols-2 gap-2" aria-hidden>
          {[0, 1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-12" />
          ))}
        </div>
      </Section>
    ) : null;
  }

  const { model, params, usage } = metadata;
  const refusedBeforeModel = turn.refusal !== null && !usage;
  if (!model && !params && !usage && metadata.estimated_cost_usd == null) return null;

  return (
    <Section title="Model & cost" icon={<Coins aria-hidden />}>
      {model ? (
        <div className="mb-2.5 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[0.8125rem] text-fg">{model.name}</span>
          <Badge size="sm">{model.provider}</Badge>
          {model.fallback_used ? (
            <Badge size="sm" tone="brand">
              Fallback served
            </Badge>
          ) : null}
        </div>
      ) : null}
      {model?.fallback_used && model.fallback_reason ? (
        <p className="mb-3 rounded-sm border border-brand-line bg-brand-soft px-3 py-2 text-2xs leading-relaxed text-fg-muted">
          Primary model failed with{" "}
          <span className="font-mono text-fg">{model.fallback_reason}</span>, so the same prompt was
          retried on the fallback.
        </p>
      ) : null}
      {refusedBeforeModel ? (
        <p className="mb-3 text-xs leading-relaxed text-fg-subtle">
          No model call: the question was refused before generation, so it used no tokens.
        </p>
      ) : null}
      <dl className="grid grid-cols-2 gap-2">
        {params?.temperature != null ? (
          <Stat label="Temperature" value={params.temperature} />
        ) : null}
        {params?.top_k != null ? <Stat label="Top-k" value={params.top_k} /> : null}
        {usage ? <Stat label="Prompt tokens" value={formatTokens(usage.prompt_tokens)} /> : null}
        {usage ? (
          <Stat label="Completion tokens" value={formatTokens(usage.completion_tokens)} />
        ) : null}
        {metadata.estimated_cost_usd != null ? (
          <Stat
            label="Estimated cost"
            value={formatUsd(metadata.estimated_cost_usd)}
            hint="List price × tokens"
          />
        ) : null}
        {params?.max_tokens != null ? (
          <Stat label="Max tokens" value={formatTokens(params.max_tokens)} />
        ) : null}
      </dl>
    </Section>
  );
}

/* Tools ----------------------------------------------------------------------------------------*/

function ToolsSection({ turn }: { turn: AssistantTurn }) {
  return (
    <Section title="Tool calls" icon={<Wrench aria-hidden />}>
      <ul className="flex flex-col gap-2">
        {turn.toolCalls.map((call) => (
          <li
            key={call.id}
            className="flex items-center gap-3 rounded-sm border border-line bg-surface-2 px-3 py-2"
          >
            <span className="min-w-0 flex-1 truncate font-mono text-2xs text-fg-muted">
              <span className="text-brand-ink">{call.name}</span>(
              {Object.entries(call.arguments)
                .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
                .join(", ")}
              )
            </span>
            {call.result ? (
              <Badge size="sm" tone={call.result.status === "success" ? "success" : "danger"}>
                {call.result.status}
              </Badge>
            ) : (
              <Badge size="sm">running</Badge>
            )}
            {call.result?.duration_ms != null ? (
              <span className="font-mono text-2xs tabular text-fg-subtle">
                {formatMs(call.result.duration_ms)}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* Trace ----------------------------------------------------------------------------------------*/

function TraceSection({ metadata }: { metadata: ResponseMetadata | null }) {
  const { copied, copy } = useCopy();
  const config = getApiConfig();
  if (!metadata?.trace_id) return null;
  const url = buildTraceUrl(metadata.trace_id, metadata.trace_url, config.langfuseProjectUrl);

  return (
    <Section title="Langfuse trace" icon={<Waypoints aria-hidden />}>
      <div className="flex items-center gap-2 rounded-sm border border-line bg-surface-2 py-1.5 pl-3 pr-1.5">
        <span className="min-w-0 flex-1 truncate font-mono text-2xs text-fg-muted">
          {metadata.trace_id}
        </span>
        <button
          type="button"
          onClick={() => void copy(metadata.trace_id ?? "")}
          className="rounded-xs px-2 py-1 text-2xs font-medium text-fg-subtle transition-colors hover:bg-surface-3 hover:text-fg focus-visible:ring-2 focus-visible:ring-ring"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-brand-ink underline decoration-brand-line underline-offset-4 hover:decoration-current"
        >
          Open this trace in Langfuse
          <ExternalLink className="size-3" aria-hidden />
        </a>
      ) : (
        <p className="mt-2.5 text-2xs leading-relaxed text-fg-subtle">
          {config.mode === "mock"
            ? "Illustrative trace ID from the demo backend. Live answers deep-link to their Langfuse trace."
            : "Return trace_url from the backend, or set NEXT_PUBLIC_LANGFUSE_PROJECT_URL, to link this trace."}
        </p>
      )}
    </Section>
  );
}
