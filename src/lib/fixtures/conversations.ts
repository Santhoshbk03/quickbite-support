/**
 * Five scripted conversations, one per capability the demo needs to prove.
 *
 * These drive three things: clicking an example question in the empty state, the recorded-session
 * replay when a live backend is unreachable, and the contract check suite. The mock turns each turn
 * into a real event stream, so scripted and improvised answers travel the exact same path.
 *
 * Answers are plain text and bullet points, matching what the real backend returns today. Distances
 * are hand-set to plausible cosine values. `preamble` is the text streamed *before* a tool call,
 * which is how the contract's `content_offset` is derived instead of hand-counted. Order facts in
 * the text (minutes late, fees, totals) must agree with ./orders.ts.
 */
export type Capability = "policy" | "refund" | "tool_use" | "multi_turn" | "refusal";

export interface ScriptedChunkRef {
  id: string;
  distance: number;
}

export interface ScriptedToolCall {
  order_id: string;
  duration_ms: number;
}

export interface ScriptedTimings {
  embedding: number;
  retrieval: number;
  filtering: number;
  /** Delay from the end of retrieval to the first token. */
  ttft: number;
  /** Total LLM wall time, including ttft and any second call after a tool. */
  generation: number;
}

export interface ScriptedTurn {
  user: string;
  /** Streamed before the tool call, when there is one. */
  preamble?: string;
  /** The rest of the answer. Citation markers reference chunk rank. */
  content: string;
  chunks: ScriptedChunkRef[];
  /** Set when the backend rewrote a follow-up into a standalone query before embedding. */
  standalone_query?: string;
  tool_call?: ScriptedToolCall;
  refusal?: { message: string; suggestions: string[] };
  model?: { provider: string; name: string; fallback_used: boolean; fallback_reason?: string };
  timings: ScriptedTimings;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

export interface ScriptedConversation {
  id: string;
  title: string;
  capability: Capability;
  /** One line for the replay picker and the history rail. */
  summary: string;
  turns: ScriptedTurn[];
}

export const SCRIPTED_CONVERSATIONS: readonly ScriptedConversation[] = [
  {
    id: "conv_demo_late_policy",
    title: "Late delivery compensation",
    capability: "policy",
    summary: "A pure policy question answered from three retrieved chunks, one of them unused.",
    turns: [
      {
        user: "What happens if my delivery is late?",
        content: `QuickBite measures lateness against the delivery time you were promised at checkout, and the credit is applied automatically [1].

- **10 to 20 minutes late:** a ₹40 Wallet credit.
- **21 to 40 minutes late:** the delivery fee is refunded, plus a ₹75 credit.
- **More than 40 minutes late:** 50% of the food subtotal as credit, capped at ₹300.

A few details worth knowing:

- Credits land in your QuickBite Wallet within 2 hours of delivery, so there is nothing to claim [1].
- Compensation does not apply while a weather or safety advisory is active, if you changed the address after checkout, or if the rider could not reach you for more than 10 minutes [2].
- Scheduled orders are measured against the end of your slot rather than the time you ordered [2].

If a specific order arrived late, share the order ID and I can tell you which tier it falls into.`,
        chunks: [
          { id: "chk_late-delivery-compensation_01", distance: 0.238 },
          { id: "chk_late-delivery-compensation_02", distance: 0.327 },
          { id: "chk_service-disruptions_01", distance: 0.492 },
        ],
        timings: { embedding: 31.6, retrieval: 14.2, filtering: 1.3, ttft: 402, generation: 1980 },
        usage: { prompt_tokens: 1284, completion_tokens: 236 },
      },
    ],
  },
  {
    id: "conv_demo_refund_case",
    title: "Missing item and cold food refund",
    capability: "refund",
    summary: "Tool lookup plus three policy chunks to resolve two separate claims on one order.",
    turns: [
      {
        user: "My order QB-2026-518772 came without the garlic naan and the paneer was lukewarm. Can I get a refund?",
        preamble: "Let me pull up order **QB-2026-518772** first.",
        content: `

That order from **Tandoor Theory** was delivered 22 minutes ago, and it did include **2 × Garlic Naan (₹130)**.

Here is where you stand on each issue:

- **Missing garlic naan:** missing items are refunded at full item value when reported within 2 hours of delivery, so that is **₹130** back, and no photo is needed [1].
- **Lukewarm paneer:** temperature complaints are assessed case by case with a photo attached within 2 hours. A verified complaint is compensated up to 50% of the item value, so up to **₹144.50** on the ₹289 Paneer Butter Masala [2].
- **How the money comes back:** a Wallet credit is instant, or it returns to the card you paid with in 5 to 7 business days [3].

You are inside the 2-hour window on both counts. Raise them from **Order QB-2026-518772 → Report an issue** and attach one photo of the paneer.`,
        chunks: [
          { id: "chk_missing-items_01", distance: 0.221 },
          { id: "chk_food-quality_01", distance: 0.284 },
          { id: "chk_refund-timelines_01", distance: 0.386 },
        ],
        tool_call: { order_id: "QB-2026-518772", duration_ms: 486 },
        timings: { embedding: 29.8, retrieval: 16.1, filtering: 1.1, ttft: 338, generation: 2740 },
        usage: { prompt_tokens: 1893, completion_tokens: 318 },
      },
    ],
  },
  {
    id: "conv_demo_cancelled_order",
    title: "Why was my order cancelled",
    capability: "tool_use",
    summary:
      "Order lookup on a restaurant-cancelled order, with the automatic refund path explained.",
    turns: [
      {
        user: "What happened to my order QB-2026-499203? The app just says cancelled.",
        preamble: "Checking order **QB-2026-499203** now.",
        content: `

**Green Fork Salads** cancelled it 12 minutes after you ordered, because the **Quinoa Power Bowl** was out of stock.

Since the restaurant cancelled, everything is handled for you:

- The full **₹835** is being refunded, including the delivery, packaging, and platform fees.
- A **₹50** apology credit is added to your QuickBite Wallet as well [1].
- The refund has already been initiated to your UPI account, and UPI refunds usually land within 2 to 4 business days [2].

There is no claim to raise. If it has not arrived by then, quote the refund reference on the order page and support can trace it with the processor [2].`,
        chunks: [
          { id: "chk_cancellations-restaurant_01", distance: 0.244 },
          { id: "chk_refund-timelines_01", distance: 0.371 },
          { id: "chk_refunds-and-credits_01", distance: 0.528 },
        ],
        tool_call: { order_id: "QB-2026-499203", duration_ms: 442 },
        timings: { embedding: 30.4, retrieval: 13.9, filtering: 1.2, ttft: 361, generation: 2410 },
        usage: { prompt_tokens: 1747, completion_tokens: 262 },
      },
    ],
  },
  {
    id: "conv_demo_late_order_followups",
    title: "Tracking a late order, then compensation",
    capability: "multi_turn",
    summary:
      "Three turns where each follow-up is rewritten into a standalone query, ending on an Ollama fallback.",
    turns: [
      {
        user: "Where's my order QB-2026-481213? It's been almost an hour.",
        preamble: "Let me pull up order **QB-2026-481213**.",
        content: `

Your order from **Dosa Republic** is on its way. Ravi picked it up 9 minutes ago, and the latest estimate puts it about **11 minutes** away [1].

It is running behind: that estimate is **28 minutes** later than the time promised at checkout, mostly because the kitchen took longer than usual to get it ready.`,
        chunks: [
          { id: "chk_delivery-tracking_01", distance: 0.312 },
          { id: "chk_late-delivery-compensation_01", distance: 0.447 },
          { id: "chk_failed-delivery_01", distance: 0.583 },
        ],
        tool_call: { order_id: "QB-2026-481213", duration_ms: 412.6 },
        timings: { embedding: 31.1, retrieval: 14.8, filtering: 1.4, ttft: 344, generation: 2180 },
        usage: { prompt_tokens: 1486, completion_tokens: 139 },
      },
      {
        user: "Do I get anything for the delay?",
        standalone_query:
          "What compensation applies when order QB-2026-481213 arrives 28 minutes later than the time promised at checkout?",
        content: `Yes. At **28 minutes** late, QB-2026-481213 sits in the 21 to 40 minute tier: the **₹35 delivery fee is refunded** and a **₹75 Wallet credit** is added [1].

Two things worth knowing:

- It is applied automatically within 2 hours of delivery, so there is nothing to claim [1].
- If it slips past **40 minutes** late and still has not been handed to you, you can cancel from the order page for a full refund instead [3].

The usual exemptions do not apply here: there is no weather advisory, the address was not changed after checkout, and the rider has not reported trouble reaching you [2].`,
        chunks: [
          { id: "chk_late-delivery-compensation_01", distance: 0.196 },
          { id: "chk_late-delivery-compensation_02", distance: 0.341 },
          { id: "chk_late-delivery-compensation_03", distance: 0.404 },
        ],
        timings: { embedding: 28.9, retrieval: 12.6, filtering: 1.0, ttft: 298, generation: 1870 },
        usage: { prompt_tokens: 1655, completion_tokens: 193 },
      },
      {
        user: "Can I just cancel it instead?",
        standalone_query:
          "Can a customer cancel an order that has already been picked up by a rider and is running late?",
        content: `Not at this point. QB-2026-481213 has already been picked up, and once a rider has collected an order it can no longer be cancelled [1].

The exception is the 40-minute mark:

- If an order is more than **40 minutes** late and has not been handed to you, cancelling becomes free and refunds in full, fees included [2][3].
- At 28 minutes late you are not there yet, so the app will not offer a cancel button on this order [1].

If it does cross 40 minutes before Ravi arrives, the option appears on the order page on its own.`,
        chunks: [
          { id: "chk_cancellations-customer_01", distance: 0.229 },
          { id: "chk_cancellations-customer_02", distance: 0.318 },
          { id: "chk_late-delivery-compensation_03", distance: 0.437 },
        ],
        // Demonstrates the Groq -> Ollama fallback in the inspector, with the slower pacing it implies.
        model: {
          provider: "ollama",
          name: "llama3.1:8b",
          fallback_used: true,
          fallback_reason: "groq: 429 rate_limit_exceeded (daily token quota)",
        },
        timings: { embedding: 30.2, retrieval: 13.1, filtering: 1.1, ttft: 1180, generation: 5240 },
        usage: { prompt_tokens: 1721, completion_tokens: 181 },
      },
    ],
  },
  {
    id: "conv_demo_refusal",
    title: "Out of scope: rider earnings",
    capability: "refusal",
    summary:
      "Nothing clears the distance threshold, so the agent refuses and shows the closest non-qualifying match.",
    turns: [
      {
        user: "How much do QuickBite delivery partners earn per order?",
        content:
          "I don't have a policy document covering delivery partner earnings, so I'd rather not guess at it.",
        chunks: [
          { id: "chk_rider-conduct_01", distance: 0.612 },
          { id: "chk_tipping_01", distance: 0.634 },
          { id: "chk_delivery-fees_01", distance: 0.671 },
        ],
        refusal: {
          message:
            "I don't have a policy document covering delivery partner earnings, so I'd rather not guess at it.",
          suggestions: [
            "How does tipping my delivery partner work?",
            "What conduct standards do QuickBite riders follow?",
            "Why was I charged a delivery fee?",
          ],
        },
        timings: { embedding: 30.2, retrieval: 13.4, filtering: 0.9, ttft: 0, generation: 0 },
      },
    ],
  },
];

export const CONVERSATIONS_BY_ID: ReadonlyMap<string, ScriptedConversation> = new Map(
  SCRIPTED_CONVERSATIONS.map((conversation) => [conversation.id, conversation]),
);

/** Normalised user text, for matching what someone actually types against the scripts. */
export function normalizeQuestion(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9'\- ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface ScriptedTurnMatch {
  conversation: ScriptedConversation;
  turn: ScriptedTurn;
  turnIndex: number;
}

const TURN_INDEX: ReadonlyMap<string, ScriptedTurnMatch[]> = (() => {
  const index = new Map<string, ScriptedTurnMatch[]>();
  for (const conversation of SCRIPTED_CONVERSATIONS) {
    conversation.turns.forEach((turn, turnIndex) => {
      const key = normalizeQuestion(turn.user);
      const matches = index.get(key) ?? [];
      matches.push({ conversation, turn, turnIndex });
      index.set(key, matches);
    });
  }
  return index;
})();

/**
 * Find the scripted turn for a question.
 *
 * A follow-up only matches when the preceding scripted question is actually in the history,
 * so "Do I get anything for the delay?" asked cold falls through to the improvising engine
 * instead of answering about an order nobody mentioned.
 */
export function matchScriptedTurn(
  question: string,
  priorUserMessages: readonly string[],
): ScriptedTurnMatch | null {
  const candidates = TURN_INDEX.get(normalizeQuestion(question));
  if (!candidates || candidates.length === 0) return null;

  const normalizedHistory = priorUserMessages.map(normalizeQuestion);
  for (const candidate of candidates) {
    if (candidate.turnIndex === 0) return candidate;
    const expectedPrevious = normalizeQuestion(
      candidate.conversation.turns[candidate.turnIndex - 1].user,
    );
    if (normalizedHistory.includes(expectedPrevious)) return candidate;
  }
  return null;
}

/** Full text of a turn as the user sees it, preamble included. */
export function scriptedTurnContent(turn: ScriptedTurn): string {
  return `${turn.preamble ?? ""}${turn.content}`;
}
