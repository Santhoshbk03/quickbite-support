/**
 * Backend connection state for the header badge and the fallback banner.
 */
import { create } from "zustand";

import { getChatClient, MockChatClient, parseMockOptionsFromSearch } from "@/lib/api";
import type { HealthResponse } from "@/lib/api";
import { ResilientChatClient } from "@/lib/api/resilient-client";

export type ConnectionStatus = "checking" | "demo" | "live" | "degraded" | "offline";

interface ConnectionState {
  status: ConnectionStatus;
  health: HealthResponse | null;
  lastCheckedAt: number | null;
  checking: boolean;
  /** Live mode only: answers are currently coming from fixtures. */
  fallbackActive: boolean;
}

export const useConnectionStore = create<ConnectionState>(() => ({
  status: "checking",
  health: null,
  lastCheckedAt: null,
  checking: false,
  fallbackActive: false,
}));

const LIVE_POLL_MS = 60_000;

export async function checkBackendHealth(signal?: AbortSignal): Promise<void> {
  const client = getChatClient();
  useConnectionStore.setState({ checking: true });
  try {
    const health = await client.getHealth({ signal });
    useConnectionStore.setState({
      health,
      checking: false,
      lastCheckedAt: Date.now(),
      status:
        client.mode === "mock"
          ? "demo"
          : health.status === "ok"
            ? "live"
            : health.status === "degraded"
              ? "degraded"
              : "offline",
    });
  } catch {
    if (signal?.aborted) return;
    useConnectionStore.setState({
      checking: false,
      lastCheckedAt: Date.now(),
      status: client.mode === "mock" ? "demo" : "offline",
    });
  }
}

/**
 * Starts health polling (live mode) and applies mock URL overrides such as
 * `?mock_failure=mid_stream`, so every error state can be demonstrated with a link.
 */
export function startConnectionMonitor(): () => void {
  const client = getChatClient();

  if (client instanceof MockChatClient) {
    client.configure(parseMockOptionsFromSearch(new URLSearchParams(window.location.search)));
    useConnectionStore.setState({ status: "demo" });
  }

  const unsubscribe =
    client instanceof ResilientChatClient
      ? client.subscribe(() =>
          useConnectionStore.setState({ fallbackActive: client.isFallbackActive }),
        )
      : () => undefined;

  const controller = new AbortController();
  void checkBackendHealth(controller.signal);
  const interval =
    client.mode === "live" ? setInterval(() => void checkBackendHealth(), LIVE_POLL_MS) : null;

  return () => {
    controller.abort();
    if (interval) clearInterval(interval);
    unsubscribe();
  };
}
