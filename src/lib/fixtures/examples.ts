/**
 * The curated example questions for the empty state.
 *
 * Each one demonstrates a different capability, and the set deliberately includes an out-of-scope
 * question so a reviewer sees the refusal behaviour without having to think one up. The last one is
 * not scripted: it goes through the mock's retriever and answer composition, which proves the demo
 * is not a list of canned replies.
 */
import type { Capability } from "./conversations";

export interface ExampleQuestion {
  id: string;
  /** Card headline. */
  label: string;
  /** Sent verbatim as the user message. */
  question: string;
  /** Supporting line: what this answer shows. */
  demonstrates: string;
  capability: Capability;
  /** Suggested next questions offered after the answer lands. */
  followUps?: string[];
  /** True when the answer is composed on the fly rather than replayed from a script. */
  improvised?: boolean;
}

export const EXAMPLE_QUESTIONS: readonly ExampleQuestion[] = [
  {
    id: "example_late_policy",
    label: "Late delivery policy",
    question: "What happens if my delivery is late?",
    demonstrates: "Retrieval over policy documents, with one retrieved chunk left unused",
    capability: "policy",
    followUps: ["Does that apply to scheduled orders?", "What if it was raining?"],
  },
  {
    id: "example_refund_case",
    label: "Missing item and cold food",
    question:
      "My order QB-51877 came without the garlic naan and the paneer was lukewarm. Can I get a refund?",
    demonstrates: "Tool call plus three policy chunks to settle two claims at once",
    capability: "refund",
    followUps: ["How long will the refund take?", "Can I get it as Wallet credit instead?"],
  },
  {
    id: "example_order_lookup",
    label: "Track a late order",
    question: "Where's my order QB-48213? It's been almost an hour.",
    demonstrates: "lookup_order tool call rendered as a live order card",
    capability: "multi_turn",
    followUps: ["Do I get anything for the delay?", "Can I just cancel it instead?"],
  },
  {
    id: "example_cancelled_order",
    label: "Cancelled by the restaurant",
    question: "What happened to my order QB-49920? The app just says cancelled.",
    demonstrates: "Order state and the automatic refund path, from tool data plus policy",
    capability: "tool_use",
    followUps: ["When will the refund reach my UPI?"],
  },
  {
    id: "example_out_of_scope",
    label: "Deliberately out of scope",
    question: "How much do QuickBite delivery partners earn per order?",
    demonstrates: "Nothing clears the distance threshold, so the agent refuses and shows why",
    capability: "refusal",
    followUps: ["How does tipping my delivery partner work?"],
  },
  {
    id: "example_improvised_cancellation",
    label: "Cancelling mid-cook",
    question: "Can I cancel an order after the restaurant has started cooking?",
    demonstrates: "Not scripted: retrieved and composed live by the mock retriever",
    capability: "policy",
    improvised: true,
    followUps: ["What if the restaurant cancels instead?"],
  },
];
