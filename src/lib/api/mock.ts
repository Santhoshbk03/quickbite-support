/**
 * Demo data behind the same QuickBiteApi interface as the live client.
 *
 * Sign-in accepts the demo accounts in the order fixtures, and every order call is scoped to the
 * signed-in customer, as the live API is expected to be. Chat replies are composed locally: an order
 * question looks up one of the customer's orders, anything else goes through a small keyword
 * retriever over the policy documents, and a question no policy covers is declined.
 */
import { POLICIES_BY_ID, POLICY_DOCUMENTS } from "@/lib/fixtures/documents";
import type { FixtureDocument } from "@/lib/fixtures/documents";
import {
  findCustomer,
  normalizeOrderId,
  ordersForCustomer,
  toApiOrder,
} from "@/lib/fixtures/orders";
import type { FixtureOrder } from "@/lib/fixtures/orders";
import { formatAmount, formatClock, formatRelativeDay, truncate } from "@/lib/format";
import { createId } from "@/lib/ids";
import {
  firstName,
  humanize,
  isActiveOrder,
  orderTiming,
  readNumber,
  readString,
} from "@/lib/order-view";
import { ApiError } from "./http";
import { createRetriever } from "./retriever";
import type { RetrievedChunk } from "./retriever";
import type {
  ChatRequest,
  ChatResponse,
  Order,
  PolicySummary,
  QuickBiteApi,
  Source,
} from "./types";

function latency(ms: number): Promise<void> {
  // Background tabs throttle timers heavily, so skip the simulated delay there.
  const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
  const jittered = ms + Math.round(Math.random() * ms * 0.4);
  return new Promise((resolve) => setTimeout(resolve, hidden ? 0 : jittered));
}

/* Policies -------------------------------------------------------------------------------------*/

function toSummary(document: FixtureDocument): PolicySummary {
  return {
    id: document.slug,
    title: document.title,
    category: document.category,
    summary: document.chunks[0]?.gist ?? null,
    version: document.version,
    effective_date: document.effective_date,
  };
}

function toSource(document: FixtureDocument, chunkIndex = 0): Source {
  const chunk = document.chunks[chunkIndex] ?? document.chunks[0];
  return {
    id: document.slug,
    title: document.title,
    snippet: chunk ? truncate(chunk.text, 180) : null,
  };
}

const retrieve = createRetriever(POLICY_DOCUMENTS);

/* Chat replies ---------------------------------------------------------------------------------*/

type ReplyBody = Omit<ChatResponse, "message_id">;

const ORDER_ID = /\bQB[\s-]?\d{4}[\s-]?\d{6}\b/i;
const ORDER_INTENT =
  /\b(where(?:'s| is)|track|status of|when will)\b[^.?!]*\b(order|food)\b|\border status\b|\bis my (?:order|food)\b|\b(?:latest|last|recent|current|cancelled|canceled) orders?\b|\bmy orders\b/i;
/** Questions that name which order they mean, so an order from earlier in the chat doesn't apply. */
const NAMES_AN_ORDER = /\b(latest|last|recent|current|cancel)/i;
const GREETING = /^(hi|hello|hey|good (morning|afternoon|evening))\b/i;
const THANKS = /^(thanks|thank you|thx|ty)\b/i;

const LATEST_ORDER_QUESTION = "Where is my latest order?";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

function reply(body: Pick<ReplyBody, "answer"> & Partial<ReplyBody>): ReplyBody {
  return { sources: [], order: null, refused: false, suggestions: [], ...body };
}

function bulletList(lines: string[]): string {
  return lines.map((line) => `- ${line}`).join("\n");
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function paymentLabel(method: string): string {
  return method.length <= 4 ? method.toUpperCase() : humanize(method);
}

function describeWhen(isoString: string, now: Date): string {
  const day = formatRelativeDay(isoString, now);
  const clock = formatClock(isoString);
  if (day === "Today") return `at ${clock}`;
  if (day === "Yesterday") return `yesterday at ${clock}`;
  return `on ${day} at ${clock}`;
}

const ACTIVE_PHASES: Record<string, (rider: string | null) => string> = {
  placed: () => "has been placed and is waiting for the restaurant",
  accepted: () => "has been accepted by the restaurant",
  confirmed: () => "has been confirmed by the restaurant",
  preparing: () => "is being prepared",
  ready_for_pickup: () => "is ready and waiting for a rider",
  picked_up: (rider) => `is on the way${rider ? ` with ${rider}` : ""}`,
  out_for_delivery: (rider) => `is on the way${rider ? ` with ${rider}` : ""}`,
};

const REFUND_PHRASES: Record<string, string> = {
  initiated: "is on its way",
  pending: "is pending",
  processing: "is being processed",
  completed: "has been completed",
  processed: "has been processed",
};

function describeOrder(order: Order, now: Date): Omit<ReplyBody, "order" | "refused"> {
  const timing = orderTiming(order, now.getTime());
  const currency = order.currency ?? "INR";
  const restaurant = `**${order.restaurant.name}**`;
  const rider = order.driver ? firstName(order.driver.name) : null;
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const bullets: string[] = [];
  let lead: string;
  let policy: { slug: string; chunk: number };
  let suggestions: string[];

  if (order.status === "cancelled") {
    const by = readString(order.cancellation, "cancelled_by");
    const reason = readString(order.cancellation, "reason");
    const who = by ? ` by ${by === "quickbite" ? "QuickBite" : `the ${by}`}` : "";
    lead = `Your order from ${restaurant} was cancelled${who}${reason ? ` (${reason})` : ""}.`;

    const amount = readNumber(order.refund, "amount");
    const method = readString(order.refund, "method");
    if (amount !== null) {
      const status = readString(order.refund, "status") ?? "initiated";
      const phrase = REFUND_PHRASES[status] ?? `is ${humanize(status).toLowerCase()}`;
      const destination = method ? ` to ${paymentLabel(method)}` : "";
      bullets.push(`A **${formatAmount(amount, currency)}** refund${destination} ${phrase}.`);
    }
    const expectedBy = readString(order.refund, "expected_by");
    if (expectedBy) {
      bullets.push(`It should reach you by **${dateFormatter.format(new Date(expectedBy))}**.`);
    }

    policy =
      by === "customer"
        ? { slug: "cancellations-customer", chunk: 0 }
        : { slug: "cancellations-restaurant", chunk: by === "quickbite" ? 1 : 0 };
    suggestions = [
      method === "upi" ? "How long do UPI refunds take?" : "How long do refunds take?",
      "Is my promo code reinstated after a cancellation?",
    ];
  } else if (order.status === "delivered" && order.timestamps.delivered_at) {
    lead = `Your order from ${restaurant} was delivered ${describeWhen(order.timestamps.delivered_at, now)}${rider ? ` by ${rider}` : ""}.`;
    const minutes = timing.minutesVsPromise;
    if (minutes !== null) {
      bullets.push(
        minutes > 0
          ? `That was **${plural(minutes, "minute")} later** than the time promised at checkout.`
          : minutes < 0
            ? `That was ${plural(-minutes, "minute")} earlier than promised at checkout.`
            : "It arrived right on time.",
      );
    }
    const paidWith = order.payment_method ? ` by ${paymentLabel(order.payment_method)}` : "";
    bullets.push(
      `You paid **${formatAmount(order.total, currency)}** for ${plural(itemCount, "item")}${paidWith}.`,
    );
    policy = timing.isLate
      ? { slug: "late-delivery-compensation", chunk: 0 }
      : { slug: "missing-items", chunk: 0 };
    suggestions = timing.isLate
      ? ["Can I get compensation for a late delivery?"]
      : ["An item was missing from my delivery", "My food arrived cold"];
  } else if (isActiveOrder(order.status)) {
    const phase =
      ACTIVE_PHASES[order.status]?.(rider) ?? `is ${humanize(order.status).toLowerCase()}`;
    const arrival =
      timing.minutesRemaining !== null
        ? ` and should arrive in about **${plural(timing.minutesRemaining, "minute")}**`
        : "";
    lead = `Your order from ${restaurant} ${phase}${arrival}.`;

    if (order.timestamps.final_eta) {
      bullets.push(`Latest estimate: **${formatClock(order.timestamps.final_eta)}**.`);
    }
    if (timing.promisedAt) {
      const minutes = timing.minutesVsPromise;
      const drift =
        minutes !== null && minutes > 0
          ? `, so it's running **${plural(minutes, "minute")} late**`
          : minutes !== null && minutes < 0
            ? ", so it's ahead of schedule"
            : "";
      bullets.push(`Promised at checkout: ${formatClock(timing.promisedAt)}${drift}.`);
    }
    policy = timing.isLate
      ? { slug: "late-delivery-compensation", chunk: 0 }
      : { slug: "delivery-tracking", chunk: 0 };
    suggestions = timing.isLate
      ? ["Can I get compensation for a late delivery?", "Can I cancel a late order?"]
      : ["What are the charges if I cancel an order?"];
  } else {
    lead = `Your order from ${restaurant} is currently **${humanize(order.status).toLowerCase()}**.`;
    policy = { slug: "delivery-tracking", chunk: 1 };
    suggestions = [];
  }

  const document = POLICIES_BY_ID.get(policy.slug);
  const gist = document?.chunks[policy.chunk]?.gist;
  if (gist) bullets.push(gist);

  return {
    answer: [lead, bulletList(bullets)].filter(Boolean).join("\n\n"),
    sources: document ? [toSource(document, policy.chunk)] : [],
    suggestions,
  };
}

function orderReply(fixture: FixtureOrder, orders: readonly FixtureOrder[], now: Date): ReplyBody {
  const order = toApiOrder(fixture, now);
  const described = describeOrder(order, now);
  const otherActive = orders
    .filter((other) => other !== fixture && isActiveOrder(other.record.status))
    .map((other) => `Where is my order ${other.record.order_id}?`);
  return reply({
    ...described,
    order,
    suggestions: [...(described.suggestions ?? []), ...otherActive].slice(0, 3),
  });
}

function orderNotFound(id: string): ReplyBody {
  return reply({
    answer: `I couldn't find an order with the ID **${id}** on your account.\n\n${bulletList([
      "Check the ID on your order confirmation.",
      "All your orders are listed on the [Orders page](/orders).",
    ])}`,
    suggestions: [LATEST_ORDER_QUESTION],
  });
}

/** For "where is my order?" without an ID: the order the customer most likely means. */
function pickOrder(
  orders: readonly FixtureOrder[],
  message: string,
  now: Date,
): FixtureOrder | null {
  if (/cancel/i.test(message)) {
    const cancelled = orders.find((order) => order.record.status === "cancelled");
    if (cancelled) return cancelled;
  }
  const active = orders.filter((order) => isActiveOrder(order.record.status));
  if (/\b(late|delay|delayed|long)\b/i.test(message)) {
    const late = active.find((order) => orderTiming(toApiOrder(order, now), now.getTime()).isLate);
    if (late) return late;
  }
  return active[0] ?? orders[0] ?? null;
}

function policyReply(chunks: RetrievedChunk[]): ReplyBody {
  const documents = [...new Set(chunks.map((chunk) => chunk.document))];
  const titles = documents.map((document) => `**${document.title}**`);
  const lead =
    titles.length === 1
      ? `Here's what the ${titles[0]} says:`
      : `Here's what the ${titles.slice(0, -1).join(", ")} and ${titles.at(-1)} say:`;
  const gists = [...new Set(chunks.map((chunk) => chunk.document.chunks[chunk.chunkIndex]?.gist))];

  const primary = documents[0];
  const related = POLICY_DOCUMENTS.filter(
    (document) => document.category === primary?.category && !documents.includes(document),
  ).slice(0, 2);

  return reply({
    answer: `${lead}\n\n${bulletList(gists.filter((gist): gist is string => Boolean(gist)))}`,
    sources: documents.map((document) =>
      toSource(document, chunks.find((chunk) => chunk.document === document)?.chunkIndex),
    ),
    suggestions: related.map((document) => `Tell me about ${document.title}`),
  });
}

const REFUSAL = reply({
  answer: [
    "I couldn't find anything in QuickBite's support policies that covers that, so I'd rather not guess.",
    "",
    "I can help with:",
    bulletList([
      "**Your orders**: ask where your latest order is, or share an order ID.",
      "**Refunds and cancellations**",
      "**Delivery, payments, and your account**",
    ]),
  ].join("\n"),
  refused: true,
  suggestions: [LATEST_ORDER_QUESTION, "How long do UPI refunds take?"],
});

const NO_ORDERS = reply({
  answer: "I don't see any orders on your account yet. Once you place one, I can check on it here.",
  suggestions: ["How do refunds work?"],
});

function compose(request: ChatRequest, orders: readonly FixtureOrder[], now: Date): ReplyBody {
  const message = request.message.trim();
  const wordCount = message.split(/\s+/).length;
  const findOwned = (rawId: string) => {
    const id = normalizeOrderId(rawId);
    return id ? (orders.find((order) => order.record.order_id === id) ?? null) : null;
  };

  const mentionedId = ORDER_ID.exec(message)?.[0];
  if (mentionedId) {
    // Orders on other accounts are reported as not found, never as someone else's.
    const fixture = findOwned(mentionedId);
    return fixture
      ? orderReply(fixture, orders, now)
      : orderNotFound(normalizeOrderId(mentionedId) ?? mentionedId.toUpperCase());
  }

  if (wordCount <= 4 && THANKS.test(message)) {
    return reply({ answer: "You're welcome! Is there anything else I can help with?" });
  }
  if (wordCount <= 4 && GREETING.test(message)) {
    return reply({
      answer: `Hi! I'm the QuickBite support assistant.\n\n${bulletList([
        "Ask about your orders, for example where your latest one is.",
        "Or ask about refunds, delivery, payments, and other policies.",
      ])}`,
      suggestions: [LATEST_ORDER_QUESTION, "How long do UPI refunds take?"],
    });
  }

  if (ORDER_INTENT.test(message)) {
    // A follow-up such as "is my order late?" refers to the order discussed earlier in the chat.
    const previous = NAMES_AN_ORDER.test(message)
      ? null
      : request.history
          .toReversed()
          .map((turn) => ORDER_ID.exec(turn.content)?.[0])
          .map((id) => (id ? findOwned(id) : null))
          .find((fixture) => fixture !== null);
    const fixture = previous ?? pickOrder(orders, message, now);
    return fixture ? orderReply(fixture, orders, now) : NO_ORDERS;
  }

  const chunks = retrieve(message);
  return chunks.length > 0 ? policyReply(chunks) : REFUSAL;
}

/* Client ---------------------------------------------------------------------------------------*/

export function createMockApi(getCustomerEmail: () => string | null): QuickBiteApi {
  /** The signed-in customer's orders; a 401 when nobody is signed in, like the live API. */
  const customerOrders = (): FixtureOrder[] => {
    const email = getCustomerEmail();
    if (!email) throw new ApiError("http", "Sign in to continue.", 401);
    return ordersForCustomer(email);
  };

  return {
    health: async () => ({
      status: "ok",
      version: "demo",
      model: "mock",
      documents: POLICY_DOCUMENTS.length,
    }),

    login: async ({ email }) => {
      await latency(450);
      const customer = findCustomer(email);
      if (!customer) throw new ApiError("http", "No account found for that email.", 404);
      return { email: customer.email, name: customer.name };
    },

    chat: async (request) => {
      const orders = customerOrders();
      await latency(900);
      return { message_id: createId("msg"), ...compose(request, orders, new Date()) };
    },

    listOrders: async () => {
      const orders = customerOrders();
      await latency(350);
      const now = new Date();
      return orders.map((fixture) => toApiOrder(fixture, now));
    },

    getOrder: async (orderId) => {
      const orders = customerOrders();
      await latency(300);
      const id = normalizeOrderId(orderId);
      const fixture = orders.find((order) => order.record.order_id === id);
      if (!fixture) throw new ApiError("http", "Order not found", 404);
      return toApiOrder(fixture, new Date());
    },

    listPolicies: async () => {
      await latency(300);
      return POLICY_DOCUMENTS.map(toSummary);
    },

    getPolicy: async (policyId) => {
      await latency(250);
      const document = POLICIES_BY_ID.get(policyId);
      if (!document) throw new ApiError("http", "Policy not found", 404);
      return {
        ...toSummary(document),
        sections: document.chunks.map((chunk) => ({ heading: chunk.section, content: chunk.text })),
      };
    },

    sendFeedback: async () => {
      await latency(200);
    },
  };
}
