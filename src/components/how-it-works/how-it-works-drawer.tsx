"use client";

import { Tabs } from "@base-ui/react/tabs";
import { useRef } from "react";

import { ErrorBoundary } from "@/components/app/error-boundary";
import { Sheet } from "@/components/ui/sheet";
import type { HowItWorksTab } from "@/lib/ui/store";
import { useUiStore } from "@/lib/ui/store";
import { ArchitectureWalkthrough } from "./architecture";
import { EvalsDashboard } from "./evals-dashboard";

const TABS: { value: HowItWorksTab; label: string }[] = [
  { value: "architecture", label: "Architecture" },
  { value: "evals", label: "Evals" },
];

export function HowItWorksDrawer() {
  const open = useUiStore((state) => state.howItWorksOpen);
  const tab = useUiStore((state) => state.howItWorksTab);
  const setTab = useUiStore((state) => state.setHowItWorksTab);
  const close = useUiStore((state) => state.closeHowItWorks);
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      side="right"
      title="How this works"
      description="Architecture walkthrough and evaluation results"
      className="w-[min(100vw,54rem)]"
    >
      <Tabs.Root
        value={tab}
        onValueChange={(value) => setTab(value as HowItWorksTab)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="shrink-0 border-b border-line px-5 pt-5 sm:px-9 sm:pt-7">
          <p className="eyebrow">Engineering notes</p>
          <h2 className="mt-1 pr-10 font-display-tight text-2xl font-medium text-fg sm:text-[1.875rem]">
            How this works
          </h2>
          <Tabs.List className="mt-4 flex gap-6" aria-label="Sections">
            {TABS.map((item) => (
              <Tabs.Tab
                key={item.value}
                value={item.value}
                className="-mb-px border-b-2 border-transparent pb-3 text-sm font-medium text-fg-subtle transition-colors duration-150 hover:text-fg-muted aria-selected:border-brand aria-selected:text-fg"
              >
                {item.label}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </div>
        <div ref={scrollRef} className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
          <Tabs.Panel value="architecture" className="px-5 py-8 sm:px-9">
            <ErrorBoundary label="the architecture notes">
              <ArchitectureWalkthrough scrollContainer={scrollRef} />
            </ErrorBoundary>
          </Tabs.Panel>
          <Tabs.Panel value="evals" className="px-5 py-8 sm:px-9">
            <ErrorBoundary label="the evals dashboard">
              <EvalsDashboard />
            </ErrorBoundary>
          </Tabs.Panel>
        </div>
      </Tabs.Root>
    </Sheet>
  );
}
