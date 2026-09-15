"use client";

import { AnimatedTooltip } from "@/components/ui/animated-tooltip";
import { useIsDesktop } from "@/hooks/use-media-query";
import type { SourceChunk } from "@/lib/api";
import { formatDistance } from "@/lib/format";
import { useUiStore } from "@/lib/ui/store";

/** Inline superscript citation. Hover previews the chunk; click opens it in the source panel. */
export function CitationChip({ chunk, turnId }: { chunk: SourceChunk; turnId: string }) {
  const isDesktop = useIsDesktop();
  const openSource = useUiStore((state) => state.openSource);

  return (
    <AnimatedTooltip content={<CitationPreview chunk={chunk} />}>
      <button
        type="button"
        onClick={() => openSource({ turnId, rank: chunk.rank }, isDesktop)}
        aria-label={`Source ${chunk.rank}: ${chunk.document.title}`}
        className="relative -top-[0.42em] mx-[0.12em] inline-flex h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full border border-brand-line bg-brand-soft px-[0.28rem] align-baseline font-mono text-[0.625rem] font-semibold leading-none text-brand-ink transition-colors duration-150 hover:border-brand hover:bg-brand hover:text-on-brand focus-visible:outline-offset-1"
      >
        {chunk.rank}
      </button>
    </AnimatedTooltip>
  );
}

function CitationPreview({ chunk }: { chunk: SourceChunk }) {
  return (
    <span className="block">
      <span className="flex items-center justify-between gap-3">
        <span className="eyebrow">Source {chunk.rank}</span>
        <span className="font-mono text-2xs tabular text-fg-subtle">
          distance {formatDistance(chunk.distance)}
        </span>
      </span>
      <span className="mt-1.5 block text-sm font-medium leading-snug text-fg">
        {chunk.document.title}
      </span>
      {chunk.document.section ? (
        <span className="block text-xs text-fg-subtle">{chunk.document.section}</span>
      ) : null}
      <span className="mt-2 line-clamp-4 block text-xs leading-relaxed text-fg-muted">
        {chunk.text}
      </span>
      <span className="mt-2.5 block text-2xs font-medium text-brand-ink">
        Click to open the full chunk
      </span>
    </span>
  );
}
