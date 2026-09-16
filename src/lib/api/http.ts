/**
 * The live client, written against the QuickBite FastAPI backend. The only file that calls `fetch`.
 *
 * The backend's routes don't line up one-to-one with QuickBiteApi, so this file adapts them:
 *
 *   health        GET  /openapi.json                (reachability only)
 *   login         POST /userdetails?email=
 *   listOrders    POST /user_orders_id?email=
 *   getOrder      POST /user_order_detail?orderid=
 *   chat          POST /chat {message, email, messages}
 *   policies      not available yet
 *   sendFeedback  not available yet (ratings stay in the browser)
 *
 * Backend responses are HTTP 200 with a `{status, userdetails}` envelope, and "not found" arrives as
 * a string in `userdetails`; both are turned into ordinary errors here. docs/BACKEND.md has details.
 */
import { z } from "zod";

import { truncate } from "@/lib/format";
import { createId } from "@/lib/ids";
import { humanize } from "@/lib/order-view";
import { OrderSchema } from "./types";
import type { Order, QuickBiteApi, Source } from "./types";

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

const TIMEOUT_MS = { health: 5_000, chat: 90_000, default: 15_000 } as const;

interface RequestOptions {
  method?: "GET" | "POST";
  query?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
}

function describeHttpError(status: number, body: unknown): string {
  // FastAPI's error shape: {"detail": "..."}.
  const detail =
    body && typeof body === "object" && "detail" in body
      ? (body as { detail: unknown }).detail
      : null;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (status === 401) return "Your session has ended. Sign in again.";
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
  { method = "POST", query, body, timeoutMs = TIMEOUT_MS.default }: RequestOptions = {},
): Promise<T> {
  const url = `${baseUrl}${path}${query ? `?${new URLSearchParams(query)}` : ""}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
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

/* Backend response shapes ----------------------------------------------------------------------*/

/** Every data route answers HTTP 200 with this envelope; "not found" is a string in `userdetails`. */
function envelope<T extends z.ZodType>(payload: T) {
  return z.object({
    status: z.number().nullish(),
    userdetails: z.union([payload, z.string()]),
  });
}

function unwrap<T>(data: { status?: number | null; userdetails: T | string }, notFound: string): T {
  if (typeof data.status === "number" && data.status >= 400) {
    const message = typeof data.userdetails === "string" ? data.userdetails : notFound;
    throw new ApiError("http", message, data.status);
  }
  if (typeof data.userdetails === "string") throw new ApiError("http", notFound, 404);
  return data.userdetails;
}

const BackendCustomerSchema = z.object({
  email: z.string(),
  name: z.string().nullish(),
});

/** Backend orders carry the customer's email: used for an ownership check, then dropped. */
const BackendOrderSchema = OrderSchema.extend({
  customer_email: z.string().nullish(),
});

const BackendChatSchema = z.object({
  // The backend spells it "responce"; "response" is accepted too in case that gets fixed.
  responce: z.string().nullish(),
  response: z.string().nullish(),
  /** The full agent transcript: system prompt, turns, tool calls, and tool results. */
  messages: z.array(z.unknown()).default([]),
});

const OpenApiSchema = z.object({
  info: z.object({ version: z.string().nullish() }).nullish(),
});

/* Reading an agent turn ------------------------------------------------------------------------*/

const TranscriptMessageSchema = z.object({
  role: z.string(),
  content: z.string().nullish(),
  tool_call_id: z.string().nullish(),
  tool_calls: z
    .array(z.object({ id: z.string(), function: z.object({ name: z.string() }) }))
    .nullish(),
});

const KNOWLEDGE_BASE_TOOL = "search_knowledge_base";
const NO_KNOWLEDGE_RESULT = /^no related content found/i;
/** Files cited in a search result, e.g. "...in the file QB-REF-002-refund-processing-times.md...". */
const KNOWLEDGE_FILE = /([\w-]+(?:\.[\w-]+)*)\.md\b/g;

/** What the agent did in one turn: the policy files it cited, and whether its search came up empty. */
function readTurn(messages: unknown[]): { sources: Source[]; refused: boolean } {
  const turn = messages.flatMap((message) => {
    const parsed = TranscriptMessageSchema.safeParse(message);
    return parsed.success ? [parsed.data] : [];
  });

  const toolNames = new Map<string, string>();
  for (const message of turn) {
    for (const call of message.tool_calls ?? []) toolNames.set(call.id, call.function.name);
  }
  const results = turn
    .filter((message) => message.role === "tool")
    .map((message) => ({
      tool: toolNames.get(message.tool_call_id ?? "") ?? "",
      content: message.content?.trim() ?? "",
    }));
  const knowledgeResults = results.filter((result) => result.tool === KNOWLEDGE_BASE_TOOL);

  const sources = new Map<string, Source>();
  for (const result of knowledgeResults) {
    for (const match of result.content.matchAll(KNOWLEDGE_FILE)) {
      const file = match[1];
      if (!file || sources.has(file)) continue;
      sources.set(file, {
        id: file,
        // "QB-REF-002-refund-processing-times" → "Refund processing times"
        title: humanize(file.replace(/^[A-Z]+-[A-Z]+-\d+-/, "")),
        snippet: truncate(result.content, 220),
        href: null,
      });
    }
  }

  const toolsUsed = [...toolNames.values()];
  const refused =
    toolsUsed.length > 0 &&
    toolsUsed.every((name) => name === KNOWLEDGE_BASE_TOOL) &&
    knowledgeResults.length > 0 &&
    knowledgeResults.every((result) => NO_KNOWLEDGE_RESULT.test(result.content));

  return { sources: [...sources.values()], refused };
}

/** The model sometimes writes IDs with non-breaking or typographic hyphens ("QB‑2026‑411004"). */
const DASHES = /[‐-―−]/g;
const ORDER_ID = /\bQB-\d{4}-\d{6}\b/gi;

function mentionedOrderIds(answer: string): string[] {
  const ids = answer.replace(DASHES, "-").match(ORDER_ID) ?? [];
  return [...new Set(ids.map((id) => id.toUpperCase()))];
}

/* Client ---------------------------------------------------------------------------------------*/

export function createHttpApi(
  baseUrl: string,
  getCustomerEmail: () => string | null,
): QuickBiteApi {
  function send<T>(path: string, schema: z.ZodType<T>, options?: RequestOptions): Promise<T> {
    return request(baseUrl, path, schema, options);
  }

  function requireEmail(): string {
    const email = getCustomerEmail();
    if (!email) throw new ApiError("http", "Sign in to continue.", 401);
    return email;
  }

  async function getOrder(orderId: string): Promise<Order> {
    const email = requireEmail();
    const data = await send("/user_order_detail", envelope(BackendOrderSchema), {
      query: { orderid: orderId.trim().replace(DASHES, "-").toUpperCase() },
    });
    const order = unwrap(data, "Order not found");
    // The backend returns any order by ID, so only the signed-in customer's own orders are shown.
    if (order.customer_email?.trim().toLowerCase() !== email) {
      throw new ApiError("http", "Order not found", 404);
    }
    return OrderSchema.parse(order);
  }

  function notProvided(what: string): ApiError {
    return new ApiError("http", `The backend doesn't provide ${what} yet.`, 404);
  }

  return {
    health: async () => {
      const spec = await send("/openapi.json", OpenApiSchema, {
        method: "GET",
        timeoutMs: TIMEOUT_MS.health,
      });
      return { status: "ok", version: spec.info?.version ?? null, model: null, documents: null };
    },

    login: async ({ email }) => {
      const data = await send("/userdetails", envelope(z.array(BackendCustomerSchema)), {
        query: { email },
      });
      const customer = unwrap(data, "No account found for that email.")[0];
      if (!customer) throw new ApiError("http", "No account found for that email.", 404);
      return { email: customer.email.trim().toLowerCase(), name: customer.name ?? null };
    },

    chat: async ({ message, transcript }) => {
      const email = requireEmail();
      const previous = transcript ?? [];
      const data = await send("/chat", BackendChatSchema, {
        body: { message, email, messages: previous },
        timeoutMs: TIMEOUT_MS.chat,
      });

      const answer = (data.responce ?? data.response ?? "").trim();
      if (!answer) throw new ApiError("invalid", "The backend sent an empty answer.", 200);

      // The backend appends this turn to the transcript it was sent.
      const turn =
        data.messages.length >= previous.length
          ? data.messages.slice(previous.length)
          : data.messages;
      const { sources, refused } = readTurn(turn);

      // Show an order card when the answer is about exactly one of the customer's orders.
      const [onlyId, ...otherIds] = mentionedOrderIds(answer);
      const order =
        onlyId && otherIds.length === 0 ? await getOrder(onlyId).catch(() => null) : null;

      return {
        message_id: createId("msg"),
        answer,
        sources,
        order,
        refused,
        suggestions: null,
        transcript: data.messages,
      };
    },

    listOrders: async () => {
      const email = requireEmail();
      const data = await send("/user_orders_id", envelope(z.array(BackendOrderSchema)), {
        query: { email },
      });
      const orders = typeof data.userdetails === "string" ? [] : unwrap(data, "No orders found");
      return orders
        .map((order) => OrderSchema.parse(order))
        .sort((a, b) => Date.parse(b.timestamps.placed_at) - Date.parse(a.timestamps.placed_at));
    },

    getOrder,

    listPolicies: async () => {
      throw notProvided("policies");
    },

    getPolicy: async () => {
      throw notProvided("policies");
    },

    sendFeedback: async () => {
      // No feedback endpoint yet: ratings are kept in the browser only.
    },
  };
}
