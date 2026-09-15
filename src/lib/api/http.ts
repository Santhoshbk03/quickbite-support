/**
 * The live client: plain JSON over fetch. The only file in the app that calls `fetch`.
 */
import { z } from "zod";

import {
  ChatResponseSchema,
  HealthSchema,
  OrderSchema,
  OrdersResponseSchema,
  PoliciesResponseSchema,
  PolicySchema,
} from "./types";
import type { QuickBiteApi } from "./types";

export type ApiErrorKind = "network" | "timeout" | "http" | "invalid";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  /** HTTP status for `http` errors, otherwise null. */
  readonly status: number | null;

  constructor(kind: ApiErrorKind, message: string, status: number | null = null, cause?: unknown) {
    super(message, { cause });
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }

  static from(error: unknown): ApiError {
    if (error instanceof ApiError) return error;
    return new ApiError(
      "network",
      error instanceof Error ? error.message : "Something went wrong.",
      null,
      error,
    );
  }

  /** The API is unreachable or broken, as opposed to answering "no". Worth falling back to demo data. */
  get isOutage(): boolean {
    return (
      this.kind === "network" ||
      this.kind === "timeout" ||
      (this.status !== null && this.status >= 500)
    );
  }
}

const TIMEOUT_MS = { health: 5_000, chat: 60_000, default: 10_000 } as const;

function describeHttpError(status: number, body: unknown): string {
  // FastAPI's error shape: {"detail": "Order not found"}.
  const detail =
    body && typeof body === "object" && "detail" in body
      ? (body as { detail: unknown }).detail
      : null;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (status === 404) return "Not found.";
  if (status === 422) return "The API rejected the request as invalid.";
  if (status === 429) return "Too many requests. Wait a moment and try again.";
  if (status >= 500) return "The API ran into a problem.";
  return `The API responded with status ${status}.`;
}

async function request<T>(
  baseUrl: string,
  path: string,
  schema: z.ZodType<T>,
  {
    method = "GET",
    body,
    timeoutMs = TIMEOUT_MS.default,
  }: {
    method?: "GET" | "POST";
    body?: unknown;
    timeoutMs?: number;
  } = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method,
        headers:
          body === undefined
            ? { Accept: "application/json" }
            : { Accept: "application/json", "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new ApiError("timeout", "The API took too long to respond.", null, error);
      }
      throw new ApiError("network", "Couldn't reach the API.", null, error);
    }

    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        if (response.ok) {
          throw new ApiError("invalid", `${method} ${path} didn't return JSON.`, response.status);
        }
      }
    }

    if (!response.ok) {
      throw new ApiError("http", describeHttpError(response.status, data), response.status);
    }

    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      console.error(`Unexpected response from ${method} ${path}`, parsed.error);
      const issue = parsed.error.issues[0];
      const where = issue ? ` (${issue.path.join(".") || "body"}: ${issue.message})` : "";
      throw new ApiError(
        "invalid",
        `${method} ${path} returned an unexpected response${where}.`,
        response.status,
      );
    }
    return parsed.data;
  } finally {
    clearTimeout(timer);
  }
}

export function createHttpApi(baseUrl: string): QuickBiteApi {
  return {
    health: () => request(baseUrl, "/health", HealthSchema, { timeoutMs: TIMEOUT_MS.health }),

    chat: (body) =>
      request(baseUrl, "/chat", ChatResponseSchema, {
        method: "POST",
        body,
        timeoutMs: TIMEOUT_MS.chat,
      }),

    listOrders: async () => (await request(baseUrl, "/orders", OrdersResponseSchema)).orders,

    getOrder: (orderId) => request(baseUrl, `/orders/${encodeURIComponent(orderId)}`, OrderSchema),

    listPolicies: async () =>
      (await request(baseUrl, "/policies", PoliciesResponseSchema)).policies,

    getPolicy: (policyId) =>
      request(baseUrl, `/policies/${encodeURIComponent(policyId)}`, PolicySchema),

    sendFeedback: async (body) => {
      // Any 2xx is success: 204 No Content or a small JSON acknowledgement.
      await request(baseUrl, "/feedback", z.unknown(), { method: "POST", body });
    },
  };
}
