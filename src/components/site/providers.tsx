"use client";

import { useEffect } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";
import { checkHealth, useApiStatus } from "@/lib/api";
import { rehydrateChat } from "@/lib/chat/store";

const RECHECK_MS = 30_000;

export function Providers({ children }: { children: React.ReactNode }) {
  const fallback = useApiStatus((state) => state.fallback);

  useEffect(() => {
    rehydrateChat();
    void checkHealth();
  }, []);

  // While showing demo data in place of the live API, keep checking whether it has come back.
  useEffect(() => {
    if (!fallback) return;
    const timer = setInterval(() => void checkHealth(), RECHECK_MS);
    return () => clearInterval(timer);
  }, [fallback]);

  return <TooltipProvider>{children}</TooltipProvider>;
}
