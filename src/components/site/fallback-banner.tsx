"use client";

import { RefreshCw, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { checkHealth, useApiStatus } from "@/lib/api";

export function FallbackBanner() {
  const { fallback, checking } = useApiStatus();
  if (!fallback) return null;

  return (
    <div
      role="status"
      className="flex shrink-0 items-center gap-3 border-b border-brand-line bg-brand-soft px-4 py-2 text-[0.8125rem] text-fg"
    >
      <WifiOff className="size-4 shrink-0 text-brand-ink" aria-hidden />
      <p className="min-w-0 flex-1">
        <span className="font-medium">Live API unavailable.</span>{" "}
        <span className="text-fg-muted">Showing demo data until it responds.</span>
      </p>
      <Button size="sm" variant="ghost" loading={checking} onClick={() => void checkHealth()}>
        {checking ? null : <RefreshCw aria-hidden />}
        Retry
      </Button>
    </div>
  );
}
