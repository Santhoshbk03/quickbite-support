"use client";

import { Menu, PanelRight, Workflow } from "lucide-react";

import { Wordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Kbd } from "@/components/ui/primitives";
import { isMacPlatform } from "@/hooks/use-hotkey";
import { useIsDesktop } from "@/hooks/use-media-query";
import { useActiveConversation } from "@/lib/chat/store";
import { useUiStore } from "@/lib/ui/store";
import { BackendStatus } from "./backend-status";
import { ThemeToggle } from "./theme-toggle";

export function AppHeader() {
  const conversation = useActiveConversation();
  const isDesktop = useIsDesktop();
  const inspectorOpen = useUiStore((state) =>
    isDesktop ? state.inspectorDocked || state.source !== null : state.inspectorSheetOpen,
  );
  const toggleInspector = useUiStore((state) => state.toggleInspector);
  const openHowItWorks = useUiStore((state) => state.openHowItWorks);
  const setHistoryDrawerOpen = useUiStore((state) => state.setHistoryDrawerOpen);

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-canvas px-2.5 sm:px-4">
      <IconButton
        label="Conversations"
        icon={<Menu aria-hidden />}
        className="min-[900px]:hidden"
        onClick={() => setHistoryDrawerOpen(true)}
      />
      <Wordmark compact className="min-[900px]:hidden" />

      <p className="hidden min-w-0 truncate text-sm font-medium text-fg min-[900px]:block">
        {conversation?.title ?? "New conversation"}
      </p>

      <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
        <BackendStatus />
        <Button variant="ghost" size="sm" onClick={() => openHowItWorks()} className="px-2 sm:px-3">
          <Workflow aria-hidden />
          <span className="hidden sm:inline">How it works</span>
          <span className="sr-only sm:hidden">How it works</span>
        </Button>
        <IconButton
          label={inspectorOpen ? "Hide inspector" : "Show inspector"}
          icon={<PanelRight aria-hidden />}
          aria-pressed={inspectorOpen}
          shortcut={<Kbd>{isMacPlatform() ? "⌘" : "Ctrl"} .</Kbd>}
          onClick={() => toggleInspector(isDesktop)}
          className={inspectorOpen ? "bg-surface-3 text-fg" : undefined}
        />
        <ThemeToggle />
      </div>
    </header>
  );
}
