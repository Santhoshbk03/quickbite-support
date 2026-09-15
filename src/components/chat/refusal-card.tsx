"use client";

import { FileText, SearchX, ShieldCheck } from "lucide-react";

import { DistanceScale, markState } from "@/components/inspector/distance-scale";
import { Badge } from "@/components/ui/badge";
import { Surface } from "@/components/ui/primitives";
import { useIsDesktop } from "@/hooks/use-media-query";
import { useChatStore } from "@/lib/chat/store";
import type { AssistantTurn } from "@/lib/chat/types";
import { formatDistance } from "@/lib/format";
import { useUiStore } from "@/lib/ui/store";

const FALLBACK_SUGGESTIONS = [
  "What happens if my delivery is late?",
  "How do refunds work for missing items?",
  "Can I cancel after the restaurant confirms?",
];

/**
 * A refusal is a feature, so it gets a designed state rather than an error style: calm saffron,
 * the actual reason (nothing cleared the threshold), the nearest miss and its score, and a way
 * forward. Deliberately no red anywhere.
 */
export function RefusalCard({ turn }: { turn: AssistantTurn }) {
  const send = useChatStore((state) => state.send);
  const busy = useChatStore(
    (state) => state.streamingTurnId !== null || state.replayingId !== null,
  );
  const openSource = useUiStore((state) => state.openSource);
  const isDesktop = useIsDesktop();

  const refusal = turn.refusal;
  if (!refusal) return null;

  const suggestions = refusal.suggestions?.length ? refusal.suggestions : FALLBACK_SUGGESTIONS;
  const belowThreshold = refusal.reason === "below_threshold" ? refusal : null;
  const closest = belowThreshold?.closest_match ?? null;
  const chunks = turn.retrieval?.chunks ?? (closest ? [closest] : []);

  return (
    <Surface level={1} className="overflow-hidden border-brand-line">
      <div className="flex gap-3.5 px-4 pt-4 sm:px-5 sm:pt-5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
          <SearchX className="size-[1.1rem]" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="eyebrow !text-brand-ink">
            {belowThreshold ? "No matching policy" : "Outside what I can help with"}
          </p>
          <h3 className="mt-1 font-display-tight text-[1.1875rem] font-medium leading-snug text-fg">
            I don’t have a policy document covering that.
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{refusal.message}</p>
        </div>
      </div>

      {belowThreshold ? (
        <div className="mx-4 mt-4 rounded-md border border-line bg-sunken p-3.5 sm:mx-5">
          <p className="text-[0.8125rem] leading-relaxed text-fg-muted">
            I only answer when a source is within{" "}
            <span className="font-mono text-fg">{formatDistance(belowThreshold.threshold)}</span>{" "}
            {belowThreshold.distance_metric} distance.
            {closest ? (
              <>
                {" "}
                The closest match scored{" "}
                <span className="font-mono text-fg">{formatDistance(closest.distance)}</span>, so it
                didn’t qualify.
              </>
            ) : (
              " Nothing in the knowledge base came close."
            )}
          </p>
          {chunks.length ? (
            <DistanceScale
              className="mt-3"
              threshold={belowThreshold.threshold}
              metric={belowThreshold.distance_metric}
              marks={chunks.map((chunk) => ({
                id: chunk.id,
                distance: chunk.distance,
                label: chunk.document.title,
                state: markState(chunk),
              }))}
            />
          ) : null}
          {closest ? (
            <button
              type="button"
              disabled={!turn.retrieval}
              onClick={() => openSource({ turnId: turn.id, rank: closest.rank }, isDesktop)}
              className="mt-3 flex w-full items-start gap-3 rounded-sm border border-line bg-surface-1 p-3 text-left transition-colors hover:border-line-strong focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
            >
              <FileText className="mt-0.5 size-4 shrink-0 text-fg-subtle" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-2xs text-fg-subtle">Closest non-qualifying match</span>
                <span className="block truncate text-sm font-medium text-fg">
                  {closest.document.title}
                </span>
                <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-fg-subtle">
                  {closest.text}
                </span>
              </span>
              <Badge tone="outline" size="sm" mono>
                {formatDistance(closest.distance)}
              </Badge>
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
        <p className="mb-2 text-xs font-medium text-fg-muted">Questions I can answer</p>
        <div className="flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              disabled={busy}
              onClick={() => void send(suggestion)}
              className="rounded-full border border-line-strong bg-surface-2 px-3 py-1.5 text-left text-[0.8125rem] text-fg-muted transition-colors duration-150 hover:border-brand-line hover:text-fg focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              {suggestion}
            </button>
          ))}
        </div>
        <p className="mt-4 flex items-start gap-1.5 text-2xs leading-relaxed text-fg-subtle">
          <ShieldCheck className="mt-px size-3.5 shrink-0" aria-hidden />
          Refusing here is deliberate: questions that don’t clear the threshold never reach the
          language model.
        </p>
      </div>
    </Surface>
  );
}
