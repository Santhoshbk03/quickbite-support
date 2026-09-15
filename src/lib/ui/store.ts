/**
 * Layout state: which panels are open and what they are showing.
 *
 * The docked inspector and the collapsed rail are remembered across visits. Mobile overlays and the
 * source view are transient on purpose — reopening a sheet on page load would be hostile on a phone.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type HowItWorksTab = "architecture" | "evals";

export interface SourceSelection {
  turnId: string;
  rank: number;
}

interface UiState {
  /** Desktop: inspector docked as a column. Persisted. */
  inspectorDocked: boolean;
  /** Below the docking breakpoint: inspector shown as a sheet. */
  inspectorSheetOpen: boolean;
  /** Assistant turn under inspection; null means "the latest answer". */
  inspectedTurnId: string | null;
  /** When set, the right panel shows this cited chunk instead of the inspector. */
  source: SourceSelection | null;
  railCollapsed: boolean;
  historyDrawerOpen: boolean;
  howItWorksOpen: boolean;
  howItWorksTab: HowItWorksTab;

  toggleInspector: (isDesktop: boolean) => void;
  closeInspector: () => void;
  inspectTurn: (turnId: string, isDesktop: boolean) => void;
  openSource: (selection: SourceSelection, isDesktop: boolean) => void;
  closeSource: () => void;
  setRailCollapsed: (collapsed: boolean) => void;
  setHistoryDrawerOpen: (open: boolean) => void;
  openHowItWorks: (tab?: HowItWorksTab) => void;
  setHowItWorksTab: (tab: HowItWorksTab) => void;
  closeHowItWorks: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      inspectorDocked: true,
      inspectorSheetOpen: false,
      inspectedTurnId: null,
      source: null,
      railCollapsed: false,
      historyDrawerOpen: false,
      howItWorksOpen: false,
      howItWorksTab: "architecture",

      toggleInspector: (isDesktop) => {
        if (isDesktop) {
          set({ inspectorDocked: !get().inspectorDocked, source: null });
        } else {
          set({ inspectorSheetOpen: !get().inspectorSheetOpen, source: null });
        }
      },

      closeInspector: () =>
        set({ inspectorDocked: false, inspectorSheetOpen: false, source: null }),

      inspectTurn: (turnId, isDesktop) =>
        set(
          isDesktop
            ? { inspectedTurnId: turnId, inspectorDocked: true, source: null }
            : { inspectedTurnId: turnId, inspectorSheetOpen: true, source: null },
        ),

      openSource: (selection, isDesktop) =>
        set(
          isDesktop
            ? { source: selection, inspectedTurnId: selection.turnId, inspectorDocked: true }
            : { source: selection, inspectedTurnId: selection.turnId, inspectorSheetOpen: true },
        ),

      closeSource: () => set({ source: null }),

      setRailCollapsed: (collapsed) => set({ railCollapsed: collapsed }),
      setHistoryDrawerOpen: (open) => set({ historyDrawerOpen: open }),
      openHowItWorks: (tab) =>
        set({ howItWorksOpen: true, howItWorksTab: tab ?? get().howItWorksTab }),
      setHowItWorksTab: (tab) => set({ howItWorksTab: tab }),
      closeHowItWorks: () => set({ howItWorksOpen: false }),
    }),
    {
      name: "quickbite.ui.v1",
      version: 1,
      storage: createJSONStorage(() => window.localStorage),
      skipHydration: true,
      partialize: (state) => ({
        inspectorDocked: state.inspectorDocked,
        railCollapsed: state.railCollapsed,
      }),
    },
  ),
);

export function rehydrateUi(): void {
  void useUiStore.persist.rehydrate();
}
