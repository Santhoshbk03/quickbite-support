"use client";

import { useEffect } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";
import { checkHealth, useApiStatus } from "@/lib/api";
import { rehydrateSession, useSession } from "@/lib/auth/session";
import { rehydrateChat, useChatStore } from "@/lib/chat/store";

const RECHECK_MS = 30_000;

export function Providers({ children }: { children: React.ReactNode }) {
  const fallback = useApiStatus((state) => state.fallback);
  const sessionHydrated = useSession((state) => state.hydrated);
  const email = useSession((state) => state.customer?.email ?? null);
  const chatHydrated = useChatStore((state) => state.hydrated);

  useEffect(() => {
    rehydrateSession();
    rehydrateChat();
    void checkHealth();
  }, []);

  // Conversations belong to the signed-in customer. Signing out, or in as someone else, clears them.
  useEffect(() => {
    if (sessionHydrated && chatHydrated) useChatStore.getState().resetFor(email);
  }, [sessionHydrated, chatHydrated, email]);

  // While showing demo data in place of the live API, keep checking whether it has come back.
  useEffect(() => {
    if (!fallback) return;
    const timer = setInterval(() => void checkHealth(), RECHECK_MS);
    return () => clearInterval(timer);
  }, [fallback]);

  return <TooltipProvider>{children}</TooltipProvider>;
}
