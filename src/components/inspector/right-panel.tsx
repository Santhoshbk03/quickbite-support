"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { ErrorBoundary } from "@/components/app/error-boundary";
import { Sheet } from "@/components/ui/sheet";
import { useHasRail, useIsDesktop } from "@/hooks/use-media-query";
import { useUiStore } from "@/lib/ui/store";
import { Inspector } from "./inspector";
import { SourceView } from "./source-view";

const PANEL_WIDTH = 412;

/** Docked column on wide screens; a sheet everywhere else. Shows a source when one is selected. */
export function RightPanel() {
  const isDesktop = useIsDesktop();
  const hasRail = useHasRail();
  const reduceMotion = useReducedMotion();
  const docked = useUiStore((state) => state.inspectorDocked);
  const sheetOpen = useUiStore((state) => state.inspectorSheetOpen);
  const source = useUiStore((state) => state.source);
  const closeInspector = useUiStore((state) => state.closeInspector);

  const content = (
    <ErrorBoundary label="the inspector">
      {source ? <SourceView selection={source} /> : <Inspector />}
    </ErrorBoundary>
  );

  if (!isDesktop) {
    return (
      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => {
          if (!open) closeInspector();
        }}
        side={hasRail ? "right" : "bottom"}
        title={source ? "Source" : "Inspector"}
        showClose={false}
        className={hasRail ? undefined : "h-[88dvh]"}
      >
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">{content}</div>
      </Sheet>
    );
  }

  const open = docked || source !== null;

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.aside
          key="right-panel"
          aria-label={source ? "Source" : "Inspector"}
          initial={{ width: 0 }}
          animate={{ width: PANEL_WIDTH }}
          exit={{ width: 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="relative hidden shrink-0 overflow-hidden border-l border-line bg-surface-1 xl:block"
        >
          <div className="scrollbar-thin h-full overflow-y-auto" style={{ width: PANEL_WIDTH }}>
            {content}
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
