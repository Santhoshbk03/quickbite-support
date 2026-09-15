import { useSyncExternalStore } from "react";

/** Docked inspector breakpoint. Below it, panels become sheets. */
export const DESKTOP_QUERY = "(min-width: 1280px)";
/** History rail breakpoint. Below it, the rail becomes a drawer. */
export const RAIL_QUERY = "(min-width: 900px)";

export function useMediaQuery(query: string, serverFallback = false): boolean {
  return useSyncExternalStore(
    (listener) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    },
    () => window.matchMedia(query).matches,
    () => serverFallback,
  );
}

export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY, true);
}

export function useHasRail(): boolean {
  return useMediaQuery(RAIL_QUERY, true);
}
