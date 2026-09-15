"use client";

import { ArrowLeft, ChevronLeft, ChevronRight, FileText, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { useIsDesktop } from "@/hooks/use-media-query";
import { useChatStore } from "@/lib/chat/store";
import { isAssistantTurn } from "@/lib/chat/types";
import { formatDistance, formatTokens } from "@/lib/format";
import type { SourceSelection } from "@/lib/ui/store";
import { useUiStore } from "@/lib/ui/store";
import { DistanceScale, markState } from "./distance-scale";

export function SourceView({ selection }: { selection: SourceSelection }) {
  const isDesktop = useIsDesktop();
  const closeSource = useUiStore((state) => state.closeSource);
  const closeInspector = useUiStore((state) => state.closeInspector);
  const openSource = useUiStore((state) => state.openSource);
  const turn = useChatStore((state) => {
    for (const conversation of Object.values(state.conversations)) {
      const match = conversation.turns.find((candidate) => candidate.id === selection.turnId);
      if (match && isAssistantTurn(match)) return match;
    }
    return null;
  });

  const chunks = turn?.retrieval?.chunks ?? [];
  const index = chunks.findIndex((chunk) => chunk.rank === selection.rank);
  const found = index >= 0 ? chunks[index] : null;
  const chunk =
    found && turn
      ? { ...found, used_in_answer: found.used_in_answer || turn.citedRanks.includes(found.rank) }
      : null;
  const state = chunk ? markState(chunk) : null;

  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-1 border-b border-line bg-surface-1 px-2">
        <Button variant="ghost" size="sm" onClick={closeSource} className="gap-1.5 px-2">
          <ArrowLeft aria-hidden />
          Inspector
        </Button>
        <IconButton
          label="Close panel"
          icon={<X aria-hidden />}
          className="ml-auto"
          onClick={closeInspector}
        />
      </div>

      {!chunk || !turn || !state ? (
        <p className="px-5 py-6 text-[0.8125rem] text-fg-subtle">
          This source is no longer available.
        </p>
      ) : (
        <article className="flex flex-col gap-5 px-5 py-5">
          <header>
            <div className="flex items-center justify-between gap-3">
              <p className="eyebrow">
                Source {chunk.rank} of {chunks.length}
              </p>
              {state === "cited" ? (
                <Badge tone="brand" size="sm">
                  Cited in this answer
                </Badge>
              ) : state === "passed" ? (
                <Badge size="sm">Retrieved, not cited</Badge>
              ) : (
                <Badge tone="outline" size="sm">
                  Below threshold
                </Badge>
              )}
            </div>
            <h2 className="mt-2 font-display-tight text-xl font-medium leading-snug text-fg">
              {chunk.document.title}
            </h2>
            {chunk.document.section ? (
              <p className="mt-0.5 text-[0.8125rem] text-fg-muted">{chunk.document.section}</p>
            ) : null}
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-fg-subtle">
              {chunk.document.version ? <span>{chunk.document.version}</span> : null}
              {chunk.document.effective_date ? (
                <span>effective {chunk.document.effective_date}</span>
              ) : null}
              {chunk.document.source_path ? (
                <span className="inline-flex items-center gap-1 font-mono">
                  <FileText className="size-3" aria-hidden />
                  {chunk.document.source_path}
                </span>
              ) : null}
            </p>
          </header>

          <dl className="grid grid-cols-3 gap-2">
            {[
              { label: "Distance", value: formatDistance(chunk.distance) },
              {
                label: "Threshold",
                value: turn.retrieval ? formatDistance(turn.retrieval.threshold) : "—",
              },
              { label: "Rank", value: `#${chunk.rank}` },
              ...(chunk.chunk_index != null
                ? [{ label: "Chunk", value: `#${chunk.chunk_index}` }]
                : []),
              ...(chunk.token_count != null
                ? [{ label: "Tokens", value: formatTokens(chunk.token_count) }]
                : []),
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-sm border border-line bg-surface-2 px-3 py-2"
              >
                <dt className="text-2xs text-fg-subtle">{stat.label}</dt>
                <dd className="mt-0.5 font-mono text-[0.8125rem] tabular text-fg">{stat.value}</dd>
              </div>
            ))}
          </dl>

          {turn.retrieval ? (
            <DistanceScale
              threshold={turn.retrieval.threshold}
              metric={turn.retrieval.distance_metric}
              marks={[
                { id: chunk.id, distance: chunk.distance, label: chunk.document.title, state },
              ]}
            />
          ) : null}

          <section aria-label="Full chunk text">
            <p className="mb-2 text-xs font-medium text-fg-muted">Full chunk</p>
            <blockquote className="whitespace-pre-wrap rounded-md border border-line bg-sunken p-4 text-sm leading-[1.75] text-fg">
              {chunk.text}
            </blockquote>
            <p className="mt-2.5 text-2xs leading-relaxed text-fg-subtle">
              {state === "cited"
                ? `The answer cites this chunk as [${chunk.rank}].`
                : state === "passed"
                  ? "This chunk cleared the threshold and was given to the model, but the answer didn’t need it."
                  : "This chunk was too far from the question to qualify, so the model never saw it."}
            </p>
          </section>

          {chunks.length > 1 ? (
            <nav
              aria-label="Other sources"
              className="flex items-center justify-between gap-2 border-t border-line pt-4"
            >
              <Button
                variant="ghost"
                size="sm"
                disabled={index <= 0}
                onClick={() =>
                  openSource({ turnId: turn.id, rank: chunks[index - 1].rank }, isDesktop)
                }
              >
                <ChevronLeft aria-hidden />
                Previous
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={index >= chunks.length - 1}
                onClick={() =>
                  openSource({ turnId: turn.id, rank: chunks[index + 1].rank }, isDesktop)
                }
              >
                Next
                <ChevronRight aria-hidden />
              </Button>
            </nav>
          ) : null}
        </article>
      )}
    </div>
  );
}
