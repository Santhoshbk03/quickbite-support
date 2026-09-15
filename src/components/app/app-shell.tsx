"use client";

import { useEffect } from "react";

import { ChatView } from "@/components/chat/thread";
import { COMPOSER_INPUT_ID } from "@/components/chat/composer";
import { HowItWorksDrawer } from "@/components/how-it-works/how-it-works-drawer";
import { RightPanel } from "@/components/inspector/right-panel";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useHotkey } from "@/hooks/use-hotkey";
import { useIsDesktop } from "@/hooks/use-media-query";
import { rehydrateChat } from "@/lib/chat/store";
import { startConnectionMonitor } from "@/lib/connection/store";
import { rehydrateUi, useUiStore } from "@/lib/ui/store";
import { AppHeader } from "./app-header";
import { ErrorBoundary } from "./error-boundary";
import { FallbackBanner } from "./fallback-banner";
import { HistoryRail } from "./history-rail";

export function AppShell() {
  const isDesktop = useIsDesktop();
  const toggleInspector = useUiStore((state) => state.toggleInspector);

  useEffect(() => {
    rehydrateChat();
    rehydrateUi();
    return startConnectionMonitor();
  }, []);

  useHotkey(".", () => toggleInspector(isDesktop), { mod: true });
  useHotkey("/", () => document.getElementById(COMPOSER_INPUT_ID)?.focus());
  useHotkey(
    "Escape",
    () => {
      if (useUiStore.getState().source) useUiStore.getState().closeSource();
    },
    { allowInInputs: true },
  );

  return (
    <TooltipProvider>
      <a
        href={`#${COMPOSER_INPUT_ID}`}
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[90] focus:rounded-sm focus:bg-brand focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-on-brand"
      >
        Skip to the message box
      </a>
      <div className="flex h-dvh overflow-hidden">
        <HistoryRail />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader />
          <FallbackBanner />
          <div className="flex min-h-0 flex-1">
            <main id="main" className="relative flex min-w-0 flex-1 flex-col">
              <ErrorBoundary label="this conversation" className="m-auto">
                <ChatView />
              </ErrorBoundary>
            </main>
            <RightPanel />
          </div>
        </div>
      </div>
      <HowItWorksDrawer />
    </TooltipProvider>
  );
}
