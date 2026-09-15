/**
 * The API contract as Zod schemas: the single source of truth for what the backend sends.
 *
 * Responses are validated where they enter the app, so a contract mismatch fails with a readable
 * message instead of rendering garbage. Unknown fields are stripped, which also keeps the customer
 * identifiers stored on order records (customer_email, customer_id) out of order views.
 * Documented for backend developers in docs/API.md.
 */
import { z } from "zod";

/** ISO 8601. An offset (`+05:30`) is preferred; a naive local time is accepted. */
const timestamp = z.iso.datetime({ offset: true, local: true });

/* GET /health ----------------------------------------------------------------------------------*/

export const HealthSchema = z.object({
  status: z.enum(["ok", "degraded", "down"]),
  version: z.string().nullish(),
  model: z.string().nullish(),
  documents: z.number().int().nonnegative().nullish(),
});

/* POST /auth/login -----------------------------------------------------------------------------*/

export const LoginRequestSchema = z.object({
  email: z.email(),
});

export const CustomerSchema = z.object({
  email: z.string(),
  name: z.string().nullish(),
});

export const LoginResponseSchema = z.object({ customer: CustomerSchema });

/* Orders ---------------------------------------------------------------------------------------*/

export const OrderItemSchema = z.object({
  name: z.string(),
  quantity: z.number().int().nonnegative(),
  unit_price: z.number(),
  line_total: z.number().nullish(),
});

export const OrderSchema = z.object({
  order_id: z.string(),
  /** placed | accepted | preparing | ready_for_pickup | picked_up | out_for_delivery | delivered | cancelled */
  status: z.string(),
  restaurant: z.object({
    name: z.string(),
    cuisine: z.string().nullish(),
    distance_km: z.number().nullish(),
  }),
  items: z.array(OrderItemSchema),
  subtotal: z.number().nullish(),
  discount: z.object({ promo_code: z.string().nullish(), amount: z.number() }).nullish(),
  fees: z
    .object({
      delivery_fee: z.number().nullish(),
      surge_fee: z.number().nullish(),
      packaging_charge: z.number().nullish(),
      platform_fee: z.number().nullish(),
      small_order_fee: z.number().nullish(),
    })
    .nullish(),
  taxes: z.number().nullish(),
  total: z.number(),
  /** ISO 4217. Defaults to INR. */
  currency: z.string().nullish(),
  payment_method: z.string().nullish(),
  timestamps: z.object({
    placed_at: timestamp,
    eta_at_checkout: timestamp.nullish(),
    accepted_at: timestamp.nullish(),
    final_eta: timestamp.nullish(),
    ready_for_pickup_at: timestamp.nullish(),
    picked_up_at: timestamp.nullish(),
    delivered_at: timestamp.nullish(),
    cancelled_at: timestamp.nullish(),
  }),
  delay_minutes_vs_final_eta: z.number().nullish(),
  driver: z
    .object({
      driver_id: z.string().nullish(),
      name: z.string(),
      vehicle: z.string().nullish(),
      rating: z.number().nullish(),
    })
    .nullish(),
  delivery: z
    .object({
      type: z.string().nullish(),
      address_label: z.string().nullish(),
      otp_required: z.boolean().nullish(),
      otp_entered: z.boolean().nullish(),
      proof_of_delivery_photo: z.string().nullish(),
    })
    .nullish(),
  notes_to_restaurant: z.string().nullish(),
  substitution: z.record(z.string(), z.unknown()).nullish(),
  cancellation: z.record(z.string(), z.unknown()).nullish(),
  refund: z.record(z.string(), z.unknown()).nullish(),
  issues: z.array(z.unknown()).nullish(),
});

export const OrdersResponseSchema = z.object({ orders: z.array(OrderSchema) });

/* Policies -------------------------------------------------------------------------------------*/

export const PolicySummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string().nullish(),
  summary: z.string().nullish(),
  version: z.string().nullish(),
  effective_date: z.string().nullish(),
});

export const PolicySchema = PolicySummarySchema.extend({
  sections: z.array(z.object({ heading: z.string(), content: z.string() })),
});

export const PoliciesResponseSchema = z.object({ policies: z.array(PolicySummarySchema) });

/* POST /chat -----------------------------------------------------------------------------------*/

export const ChatTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

export const ChatRequestSchema = z.object({
  session_id: z.string().min(1),
  message: z.string().min(1).max(2000),
  /** Earlier turns, oldest first, not including `message`. */
  history: z.array(ChatTurnSchema).max(20),
});

export const SourceSchema = z.object({
  /** A policy id, so the UI can link to /policies/{id}. */
  id: z.string(),
  title: z.string(),
  snippet: z.string().nullish(),
});

export const ChatResponseSchema = z.object({
  message_id: z.string(),
  /** Markdown: a short paragraph and bullet points. */
  answer: z.string(),
  sources: z.array(SourceSchema).default([]),
  /** The order the answer is about, if any. Rendered as an order card. */
  order: OrderSchema.nullish(),
  /** True when no policy covers the question and the assistant declined to answer. */
  refused: z.boolean().default(false),
  suggestions: z.array(z.string()).nullish(),
});

/* POST /feedback -------------------------------------------------------------------------------*/

export const FeedbackRequestSchema = z.object({
  session_id: z.string(),
  message_id: z.string(),
  rating: z.enum(["up", "down"]),
});

/* Types ----------------------------------------------------------------------------------------*/

export type Health = z.infer<typeof HealthSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type Customer = z.infer<typeof CustomerSchema>;
export type Order = z.infer<typeof OrderSchema>;
export type OrderItem = z.infer<typeof OrderItemSchema>;
export type PolicySummary = z.infer<typeof PolicySummarySchema>;
export type Policy = z.infer<typeof PolicySchema>;
export type ChatTurn = z.infer<typeof ChatTurnSchema>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type ChatResponse = z.infer<typeof ChatResponseSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type FeedbackRequest = z.infer<typeof FeedbackRequestSchema>;

/** Everything the UI can ask of the backend. The live and mock clients both implement this. */
export interface QuickBiteApi {
  health(): Promise<Health>;
  login(request: LoginRequest): Promise<Customer>;
  chat(request: ChatRequest): Promise<ChatResponse>;
  listOrders(): Promise<Order[]>;
  getOrder(orderId: string): Promise<Order>;
  listPolicies(): Promise<PolicySummary[]>;
  getPolicy(policyId: string): Promise<Policy>;
  sendFeedback(feedback: FeedbackRequest): Promise<void>;
}
