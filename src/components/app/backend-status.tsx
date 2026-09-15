"use client";

import { StatusDot } from "@/components/ui/badge";
import { MovingBorder } from "@/components/ui/moving-border";
import { Tooltip } from "@/components/ui/tooltip";
import { useConnectionStore } from "@/lib/connection/store";
import { cn } from "@/lib/utils";

const COPY = {
  checking: {
    label: "Connecting",
    tone: "neutral",
    detail: "Checking the backend health endpoint.",
  },
  demo: {
    label: "Demo mode",
    tone: "brand",
    detail:
      "Running on the built-in mock backend: real retrieval behaviour over 26 policy documents, streamed through the same client the live API uses.",
  },
  live: { label: "Live", tone: "success", detail: "Connected to the live backend." },
  degraded: {
    label: "Degraded",
    tone: "brand",
    detail:
      "The backend is up but its primary model is unavailable; answers use the fallback model.",
  },
  offline: {
    label: "Offline",
    tone: "danger",
    detail: "The live backend is unreachable. Answers are replayed from recorded sessions.",
  },
} as const;

/** Header badge driven by GET /health. The moving border appears only in demo mode. */
export function BackendStatus({ className }: { className?: string }) {
  const status = useConnectionStore((state) => state.status);
  const health = useConnectionStore((state) => state.health);
  const fallbackActive = useConnectionStore((state) => state.fallbackActive);

  const effective = fallbackActive && status !== "demo" ? "offline" : status;
  const copy = COPY[effective];

  const detail = (
    <span className="block max-w-64 whitespace-normal font-normal leading-relaxed">
      {copy.detail}
      {health && effective !== "offline" ? (
        <span className="mt-1.5 block font-mono text-2xs text-fg-subtle">
          {health.models.primary.name} · {health.vector_store.document_count} docs
          {health.vector_store.chunk_count ? ` · ${health.vector_store.chunk_count} chunks` : ""}
        </span>
      ) : null}
    </span>
  );

  const body = (
    <span className="inline-flex h-[26px] items-center gap-2 px-2.5 text-xs font-medium text-fg-muted">
      <StatusDot tone={copy.tone} pulse={effective === "live" || effective === "checking"} />
      <span className="hidden sm:inline">{copy.label}</span>
      <span className="sr-only sm:hidden">{copy.label}</span>
    </span>
  );

  return (
    <Tooltip content={detail} side="bottom">
      <button
        type="button"
        aria-label={`Backend status: ${copy.label}`}
        className={cn(
          "rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        {effective === "demo" ? (
          <MovingBorder radius={14}>{body}</MovingBorder>
        ) : (
          <span className="inline-flex rounded-full border border-line-strong bg-surface-2">
            {body}
          </span>
        )}
      </button>
    </Tooltip>
  );
}
