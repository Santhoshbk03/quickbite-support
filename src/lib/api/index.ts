/**
 * The one module the UI imports for data.
 *
 * `api` picks the client from env (NEXT_PUBLIC_API_MODE, NEXT_PUBLIC_API_URL). In live mode, a
 * network error, timeout, or 5xx switches the app to demo data and raises the fallback banner, so a
 * demo never dead-ends on a sleeping backend. A successful /health check switches it back. A 401
 * from either client ends the session, which sends the customer back to the login page.
 */
import { create } from "zustand";

import { getCustomerEmail, useSession } from "@/lib/auth/session";
import { API_MODE, API_URL } from "./env";
import type { ApiMode } from "./env";
import { ApiError, createHttpApi } from "./http";
import { createMockApi } from "./mock";
import type { Customer, Health, QuickBiteApi } from "./types";

export * from "./types";
export { ApiError, CUSTOMER_EMAIL_HEADER } from "./http";
export type { ApiErrorKind } from "./http";
export type { ApiMode } from "./env";

const mockApi = createMockApi(getCustomerEmail);
const liveApi = API_MODE === "live" && API_URL ? createHttpApi(API_URL, getCustomerEmail) : null;

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

async function callClient<T>(run: (client: QuickBiteApi) => Promise<T>): Promise<T> {
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

async function call<T>(run: (client: QuickBiteApi) => Promise<T>): Promise<T> {
  try {
    return await callClient(run);
  } catch (error) {
    const apiError = ApiError.from(error);
    if (apiError.status === 401) useSession.getState().clear();
    throw apiError;
  }
}

export const api: QuickBiteApi = {
  health: () => call((client) => client.health()),
  login: (request) => call((client) => client.login(request)),
  chat: (request) => call((client) => client.chat(request)),
  listOrders: () => call((client) => client.listOrders()),
  getOrder: (orderId) => call((client) => client.getOrder(orderId)),
  listPolicies: () => call((client) => client.listPolicies()),
  getPolicy: (policyId) => call((client) => client.getPolicy(policyId)),
  sendFeedback: (feedback) => call((client) => client.sendFeedback(feedback)),
};

/** Look the email up and, if it belongs to a customer, start their session. */
export async function signIn(email: string): Promise<Customer> {
  const customer = await api.login({ email: email.trim().toLowerCase() });
  useSession.getState().setCustomer(customer);
  return customer;
}

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
