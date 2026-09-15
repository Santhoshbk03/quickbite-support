"use client";

import { StatusDot } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { useApiStatus } from "@/lib/api";

/** Header badge: demo data, live API, or offline (showing demo data). */
export function ApiStatus() {
  const { mode, fallback, health, checking } = useApiStatus();

  const view =
    mode === "mock"
      ? {
          label: "Demo data",
          tone: "brand" as const,
          detail: "No backend connected. Chat, orders, and policies use built-in sample data.",
        }
      : fallback || health?.status === "down"
        ? {
            label: "API offline",
            tone: "danger" as const,
            detail: "The live API isn't responding, so demo data is shown instead.",
          }
        : checking && !health
          ? { label: "Connecting", tone: "neutral" as const, detail: "Checking GET /health." }
          : health?.status === "degraded"
            ? {
                label: "Degraded",
                tone: "brand" as const,
                detail: "The API is up but reports a problem.",
              }
            : { label: "Live API", tone: "success" as const, detail: "Connected to the live API." };

  return (
    <Tooltip
      content={<span className="block max-w-60 whitespace-normal font-normal">{view.detail}</span>}
      side="bottom"
    >
      <button
        type="button"
        aria-label={`API status: ${view.label}`}
        className="inline-flex h-7 items-center gap-2 rounded-full border border-line-strong bg-surface-2 px-2.5 text-xs font-medium text-fg-muted"
      >
        <StatusDot tone={view.tone} pulse={view.tone === "success"} />
        <span className="hidden sm:inline">{view.label}</span>
      </button>
    </Tooltip>
  );
}
