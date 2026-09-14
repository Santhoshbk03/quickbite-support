/**
 * Synthetic orders behind the `lookup_order` tool.
 *
 * Timestamps are stored as offsets from "now" and materialised at call time, so a demo opened at
 * any hour shows a plausible live order rather than a stale one. Money is in paise; totals are
 * computed, never hand-typed, so the order card always adds up.
 */
import type { LookupOrderResult, Money, OrderStatus, OrderTimelineEvent } from "@/lib/api/schemas";

export interface FixtureOrderItem {
  name: string;
  quantity: number;
  unit_price_minor: number;
  modifiers?: string[];
}

export interface FixtureTimelineStep {
  status: OrderStatus;
  label: string;
  /** Minutes after the order was placed, or null for a stage that has not happened. */
  minutes_after_placed: number | null;
  detail?: string;
}

export interface FixtureOrder {
  order_id: string;
  status: OrderStatus;
  restaurant: { id: string; name: string; area: string; cuisine: string };
  items: FixtureOrderItem[];
  placed_minutes_ago: number;
  /** The checkout ETA, in minutes after placement. This is the promise late credits are measured against. */
  promised_after_placed: number;
  /** Current estimate, in minutes after placement. For delivered orders, the actual handover time. */
  estimate_after_placed: number;
  timeline: FixtureTimelineStep[];
  delivery_fee_minor: number;
  delivery_area: string;
  payment_method: string;
  rider?: { first_name: string; vehicle: string };
  discount_minor?: number;
  tip_minor?: number;
  cancellation?: {
    by: "customer" | "restaurant" | "quickbite";
    reason: string;
    minutes_after_placed: number;
  };
  refund?: {
    status: "initiated" | "processing" | "completed";
    method: string;
    expected_in_days: number;
  };
}

const CURRENCY = "INR";
const PLATFORM_FEE_MINOR = 600;
const GST_RATE = 0.05;

export const ORDERS: readonly FixtureOrder[] = [
  {
    order_id: "QB-48213",
    status: "out_for_delivery",
    restaurant: {
      id: "rst_dosa-republic",
      name: "Dosa Republic",
      area: "Indiranagar",
      cuisine: "South Indian",
    },
    items: [
      {
        name: "Masala Dosa",
        quantity: 2,
        unit_price_minor: 14900,
        modifiers: ["Extra coconut chutney"],
      },
      { name: "Medu Vada", quantity: 1, unit_price_minor: 8900 },
      { name: "Filter Coffee", quantity: 2, unit_price_minor: 5900 },
    ],
    placed_minutes_ago: 52,
    promised_after_placed: 35,
    estimate_after_placed: 63,
    timeline: [
      { status: "placed", label: "Order placed", minutes_after_placed: 0 },
      { status: "confirmed", label: "Restaurant confirmed", minutes_after_placed: 2 },
      {
        status: "preparing",
        label: "Being prepared",
        minutes_after_placed: 4,
        detail: "Kitchen ran behind on a large order",
      },
      { status: "out_for_delivery", label: "Picked up by Ravi", minutes_after_placed: 43 },
      { status: "delivered", label: "Delivered", minutes_after_placed: null },
    ],
    delivery_fee_minor: 3500,
    delivery_area: "HAL 2nd Stage, Indiranagar",
    payment_method: "UPI",
    rider: { first_name: "Ravi", vehicle: "Scooter" },
    tip_minor: 2000,
  },
  {
    order_id: "QB-51877",
    status: "delivered",
    restaurant: {
      id: "rst_tandoor-theory",
      name: "Tandoor Theory",
      area: "Koramangala",
      cuisine: "North Indian",
    },
    items: [
      { name: "Paneer Butter Masala", quantity: 1, unit_price_minor: 28900 },
      { name: "Garlic Naan", quantity: 2, unit_price_minor: 6500 },
      { name: "Jeera Rice", quantity: 1, unit_price_minor: 14900 },
      { name: "Boondi Raita", quantity: 1, unit_price_minor: 7900 },
    ],
    placed_minutes_ago: 61,
    promised_after_placed: 38,
    estimate_after_placed: 39,
    timeline: [
      { status: "placed", label: "Order placed", minutes_after_placed: 0 },
      { status: "confirmed", label: "Restaurant confirmed", minutes_after_placed: 1 },
      { status: "preparing", label: "Being prepared", minutes_after_placed: 3 },
      { status: "out_for_delivery", label: "Picked up by Arjun", minutes_after_placed: 24 },
      { status: "delivered", label: "Delivered", minutes_after_placed: 39 },
    ],
    delivery_fee_minor: 3500,
    delivery_area: "5th Block, Koramangala",
    payment_method: "Card •••• 4242",
    rider: { first_name: "Arjun", vehicle: "Bike" },
    discount_minor: 6000,
    tip_minor: 3000,
  },
  {
    order_id: "QB-49920",
    status: "cancelled",
    restaurant: {
      id: "rst_green-fork",
      name: "Green Fork Salads",
      area: "HSR Layout",
      cuisine: "Salads & Bowls",
    },
    items: [
      { name: "Quinoa Power Bowl", quantity: 1, unit_price_minor: 32900 },
      { name: "Green Goddess Salad", quantity: 1, unit_price_minor: 27900 },
      { name: "Cold Pressed Orange", quantity: 1, unit_price_minor: 12900 },
    ],
    placed_minutes_ago: 26,
    promised_after_placed: 40,
    estimate_after_placed: 40,
    timeline: [
      { status: "placed", label: "Order placed", minutes_after_placed: 0 },
      { status: "confirmed", label: "Restaurant confirmed", minutes_after_placed: 2 },
      {
        status: "cancelled",
        label: "Cancelled by restaurant",
        minutes_after_placed: 12,
        detail: "Quinoa Power Bowl was out of stock",
      },
    ],
    delivery_fee_minor: 3500,
    delivery_area: "Sector 2, HSR Layout",
    payment_method: "UPI",
    cancellation: {
      by: "restaurant",
      reason: "Quinoa Power Bowl was out of stock",
      minutes_after_placed: 12,
    },
    refund: { status: "initiated", method: "UPI", expected_in_days: 3 },
  },
  {
    order_id: "QB-50342",
    status: "preparing",
    restaurant: {
      id: "rst_ember-pizza",
      name: "Ember Pizza Co.",
      area: "Whitefield",
      cuisine: "Pizza",
    },
    items: [
      { name: "Margherita Pizza", quantity: 1, unit_price_minor: 34900, modifiers: ["Thin crust"] },
      { name: "Garlic Breadsticks", quantity: 1, unit_price_minor: 16900 },
      { name: "Masala Lemonade", quantity: 2, unit_price_minor: 9900 },
    ],
    placed_minutes_ago: 9,
    promised_after_placed: 42,
    estimate_after_placed: 38,
    timeline: [
      { status: "placed", label: "Order placed", minutes_after_placed: 0 },
      { status: "confirmed", label: "Restaurant confirmed", minutes_after_placed: 2 },
      { status: "preparing", label: "Being prepared", minutes_after_placed: 5 },
      { status: "out_for_delivery", label: "Out for delivery", minutes_after_placed: null },
      { status: "delivered", label: "Delivered", minutes_after_placed: null },
    ],
    delivery_fee_minor: 4500,
    delivery_area: "Palm Meadows, Whitefield",
    payment_method: "QuickBite Wallet",
  },
  {
    order_id: "QB-47105",
    status: "delivered",
    restaurant: {
      id: "rst_saffron-lane",
      name: "Saffron Lane Biryani",
      area: "Jayanagar",
      cuisine: "Biryani",
    },
    items: [
      { name: "Hyderabadi Chicken Biryani", quantity: 2, unit_price_minor: 32900 },
      { name: "Mirchi Ka Salan", quantity: 1, unit_price_minor: 8900 },
      { name: "Double Ka Meetha", quantity: 1, unit_price_minor: 11900 },
    ],
    placed_minutes_ago: 1490,
    promised_after_placed: 45,
    estimate_after_placed: 41,
    timeline: [
      { status: "placed", label: "Order placed", minutes_after_placed: 0 },
      { status: "confirmed", label: "Restaurant confirmed", minutes_after_placed: 2 },
      { status: "preparing", label: "Being prepared", minutes_after_placed: 4 },
      { status: "out_for_delivery", label: "Picked up by Suresh", minutes_after_placed: 26 },
      { status: "delivered", label: "Delivered", minutes_after_placed: 41 },
    ],
    delivery_fee_minor: 3500,
    delivery_area: "4th Block, Jayanagar",
    payment_method: "UPI",
    rider: { first_name: "Suresh", vehicle: "Bike" },
  },
  {
    order_id: "QB-52260",
    status: "confirmed",
    restaurant: {
      id: "rst_noodle-bar-88",
      name: "Noodle Bar 88",
      area: "Indiranagar",
      cuisine: "Asian",
    },
    items: [
      { name: "Veg Hakka Noodles", quantity: 1, unit_price_minor: 21900 },
      { name: "Chilli Paneer", quantity: 1, unit_price_minor: 25900 },
    ],
    placed_minutes_ago: 3,
    promised_after_placed: 40,
    estimate_after_placed: 40,
    timeline: [
      { status: "placed", label: "Order placed", minutes_after_placed: 0 },
      { status: "confirmed", label: "Restaurant confirmed", minutes_after_placed: 2 },
      { status: "preparing", label: "Being prepared", minutes_after_placed: null },
      { status: "out_for_delivery", label: "Out for delivery", minutes_after_placed: null },
      { status: "delivered", label: "Delivered", minutes_after_placed: null },
    ],
    delivery_fee_minor: 3500,
    delivery_area: "Defence Colony, Indiranagar",
    payment_method: "UPI",
  },
];

export const ORDERS_BY_ID: ReadonlyMap<string, FixtureOrder> = new Map(
  ORDERS.map((order) => [order.order_id, order]),
);

/** Accepts "qb48213", "QB 48213", "#QB-48213" and normalises to "QB-48213". */
export function normalizeOrderId(raw: string): string | null {
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const match = /^QB(\d{5})$/.exec(compact);
  return match ? `QB-${match[1]}` : null;
}

export function findOrder(rawId: string): FixtureOrder | null {
  const id = normalizeOrderId(rawId);
  return id ? (ORDERS_BY_ID.get(id) ?? null) : null;
}

export function money(amountMinor: number): Money {
  return { amount_minor: amountMinor, currency: CURRENCY };
}

export function formatRupees(amountMinor: number): string {
  const rupees = amountMinor / 100;
  return `₹${Number.isInteger(rupees) ? rupees.toString() : rupees.toFixed(2)}`;
}

export function itemTotalMinor(item: FixtureOrderItem): number {
  return item.quantity * item.unit_price_minor;
}

export function subtotalMinor(order: FixtureOrder): number {
  return order.items.reduce((sum, item) => sum + itemTotalMinor(item), 0);
}

/** Materialise a fixture order into the contract's tool-result shape, relative to `now`. */
export function buildLookupOrderResult(order: FixtureOrder, now: Date): LookupOrderResult {
  const nowMs = now.getTime();
  const placedMs = nowMs - order.placed_minutes_ago * 60_000;
  const at = (minutesAfterPlaced: number) => new Date(placedMs + minutesAfterPlaced * 60_000);

  const subtotal = subtotalMinor(order);
  // GST rounded to the nearest rupee, then a flat platform fee — matches how the app itemises it.
  const taxesAndFees = Math.round((subtotal * GST_RATE) / 100) * 100 + PLATFORM_FEE_MINOR;
  const discount = order.discount_minor ?? 0;
  const tip = order.tip_minor ?? 0;
  const total = subtotal + order.delivery_fee_minor + taxesAndFees - discount + tip;

  const promisedBy = at(order.promised_after_placed);
  const estimatedAt = at(order.estimate_after_placed);
  const isDelivered = order.status === "delivered";
  const isCancelled = order.status === "cancelled";
  const minutesLate = Math.round((estimatedAt.getTime() - promisedBy.getTime()) / 60_000);
  const isLate = minutesLate > 0;

  const timeline: OrderTimelineEvent[] = order.timeline.map((step) => ({
    status: step.status,
    label: step.label,
    at: step.minutes_after_placed === null ? null : at(step.minutes_after_placed).toISOString(),
    state:
      step.minutes_after_placed === null
        ? "upcoming"
        : step.status === order.status
          ? "current"
          : "complete",
    detail: step.detail ?? null,
  }));

  return {
    order_id: order.order_id,
    status: order.status,
    placed_at: new Date(placedMs).toISOString(),
    restaurant: {
      id: order.restaurant.id,
      name: order.restaurant.name,
      area: order.restaurant.area,
      cuisine: order.restaurant.cuisine,
    },
    items: order.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit_price: money(item.unit_price_minor),
      modifiers: item.modifiers ?? null,
    })),
    totals: {
      subtotal: money(subtotal),
      delivery_fee: money(order.delivery_fee_minor),
      taxes_and_fees: money(taxesAndFees),
      discount: money(discount),
      tip: tip > 0 ? money(tip) : null,
      total: money(total),
    },
    eta: isCancelled
      ? null
      : {
          promised_by: promisedBy.toISOString(),
          estimated_at: estimatedAt.toISOString(),
          minutes_remaining: isDelivered
            ? null
            : Math.max(1, Math.round((estimatedAt.getTime() - nowMs) / 60_000)),
          is_late: isLate,
          minutes_late: isLate ? minutesLate : null,
        },
    delivered_at: isDelivered ? estimatedAt.toISOString() : null,
    timeline,
    rider: order.rider
      ? { first_name: order.rider.first_name, vehicle: order.rider.vehicle }
      : null,
    delivery_area: order.delivery_area,
    payment_method: order.payment_method,
    cancellation: order.cancellation
      ? {
          by: order.cancellation.by,
          reason: order.cancellation.reason,
          at: at(order.cancellation.minutes_after_placed).toISOString(),
        }
      : null,
    refund: order.refund
      ? {
          status: order.refund.status,
          amount: money(total),
          method: order.refund.method,
          expected_by: new Date(nowMs + order.refund.expected_in_days * 86_400_000).toISOString(),
        }
      : null,
  };
}
