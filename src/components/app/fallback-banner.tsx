"use client";

import { History, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getApiConfig } from "@/lib/api";
import { checkBackendHealth, useConnectionStore } from "@/lib/connection/store";

/** Honest, unmissable, and small: tells the viewer when answers are not coming from the live API. */
export function FallbackBanner() {
  const fallbackActive = useConnectionStore((state) => state.fallbackActive);
  const checking = useConnectionStore((state) => state.checking);
  const configError = getApiConfig().configError;

  if (!fallbackActive && !configError) return null;

  return (
    <div
      role="status"
      className="flex shrink-0 items-center gap-3 border-b border-brand-line bg-brand-soft px-4 py-2 text-[0.8125rem] text-fg"
    >
      <History className="size-4 shrink-0 text-brand-ink" aria-hidden />
      <p className="min-w-0 flex-1">
        {fallbackActive ? (
          <>
            <span className="font-medium">
              Live backend unavailable — replaying recorded sessions.
            </span>{" "}
            <span className="text-fg-muted">
              Answers come from local fixtures until it responds.
            </span>
          </>
        ) : (
          <span className="text-fg-muted">{configError}</span>
        )}
      </p>
      {fallbackActive ? (
        <Button
          size="sm"
          variant="ghost"
          loading={checking}
          onClick={() => void checkBackendHealth()}
        >
          {checking ? null : <RefreshCw aria-hidden />}
          Retry
        </Button>
      ) : null}
    </div>
  );
}
