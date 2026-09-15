/**
 * The one module the UI imports for data.
 *
 * `api` picks the client from env (NEXT_PUBLIC_API_MODE, NEXT_PUBLIC_API_URL). In live mode, a
 * network error, timeout, or 5xx switches the app to demo data and raises the fallback banner, so a
 * demo never dead-ends on a sleeping backend. A successful /health check switches it back.
 */
import { create } from "zustand";

import { API_MODE, API_URL } from "./env";
import type { ApiMode } from "./env";
import { ApiError, createHttpApi } from "./http";
import { createMockApi } from "./mock";
import type { Health, QuickBiteApi } from "./types";

export * from "./types";
export { ApiError } from "./http";
export type { ApiErrorKind } from "./http";
export type { ApiMode } from "./env";

const mockApi = createMockApi();
const liveApi = API_MODE === "live" && API_URL ? createHttpApi(API_URL) : null;

interface ApiStatus {
  mode: ApiMode;
  /** Live mode only: the API is unreachable and demo data is being shown instead. */
  fallback: boolean;
  checking: boolean;
  health: Health | null;
}

export const useApiStatus = create<ApiStatus>(() => ({
  mode: API_MODE,
  fallback: false,
  checking: liveApi !== null,
  health: null,
}));

async function call<T>(run: (client: QuickBiteApi) => Promise<T>): Promise<T> {
  if (!liveApi || useApiStatus.getState().fallback) return run(mockApi);
  try {
    return await run(liveApi);
  } catch (error) {
    const apiError = ApiError.from(error);
    if (!apiError.isOutage) throw apiError;
    useApiStatus.setState({ fallback: true });
    return run(mockApi);
  }
}

export const api: QuickBiteApi = {
  health: () => call((client) => client.health()),
  chat: (request) => call((client) => client.chat(request)),
  listOrders: () => call((client) => client.listOrders()),
  getOrder: (orderId) => call((client) => client.getOrder(orderId)),
  listPolicies: () => call((client) => client.listPolicies()),
  getPolicy: (policyId) => call((client) => client.getPolicy(policyId)),
  sendFeedback: (feedback) => call((client) => client.sendFeedback(feedback)),
};

/** Ping GET /health. In live mode this is also what ends a fallback. */
export async function checkHealth(): Promise<void> {
  if (!liveApi) {
    useApiStatus.setState({ health: await mockApi.health() });
    return;
  }
  useApiStatus.setState({ checking: true });
  try {
    const health = await liveApi.health();
    useApiStatus.setState({ health, checking: false, fallback: health.status === "down" });
  } catch (error) {
    useApiStatus.setState({
      health: null,
      checking: false,
      fallback: ApiError.from(error).isOutage,
    });
  }
}
