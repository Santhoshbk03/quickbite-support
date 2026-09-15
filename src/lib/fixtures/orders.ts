/**
 * Synthetic orders served by the mock API, in the order service's own record shape.
 *
 * Records are authored with absolute timestamps against a fixed anchor moment. "Live" orders are
 * shifted to the current time when looked up, so a demo opened at any hour still shows an order
 * 11 minutes away rather than a stale one. The last record is a real sample from the order service,
 * kept verbatim and unshifted.
 */
import type { Order } from "@/lib/api/types";

/** A stored order record. PII fields exist in storage but are never sent over the API. */
export type OrderRecord = Order & {
  customer_email?: string | null;
  customer_id?: string | null;
};

export interface FixtureOrder {
  record: OrderRecord;
  /** Shift timestamps so the order stays "in progress" whenever the demo is opened. */
  live: boolean;
}

/** Every live fixture's timestamps are written as if the current time were this moment. */
const ANCHOR_MS = Date.parse("2026-09-14T19:42:07+05:30");
const IST_OFFSET_MS = 5.5 * 3_600_000;

export const ORDERS: readonly FixtureOrder[] = [
  {
    live: true,
    record: {
      order_id: "QB-2026-481213",
      customer_email: "priya.sharma@example.com",
      customer_id: "CUST-014",
      restaurant: { name: "Dosa Republic", cuisine: "South Indian", distance_km: 3.4 },
      items: [
        { name: "Masala Dosa", quantity: 2, unit_price: 149, line_total: 298 },
        { name: "Medu Vada", quantity: 1, unit_price: 89, line_total: 89 },
        { name: "Filter Coffee", quantity: 2, unit_price: 59, line_total: 118 },
      ],
      subtotal: 505,
      discount: { promo_code: null, amount: 0.0 },
      fees: {
        delivery_fee: 35,
        surge_fee: 0,
        packaging_charge: 15,
        platform_fee: 6,
        small_order_fee: 0,
      },
      taxes: 25.0,
      total: 586.0,
      payment_method: "upi",
      status: "picked_up",
      timestamps: {
        placed_at: "2026-09-14T18:50:07+05:30",
        eta_at_checkout: "2026-09-14T19:25:07+05:30",
        accepted_at: "2026-09-14T18:52:07+05:30",
        final_eta: "2026-09-14T19:53:07+05:30",
        ready_for_pickup_at: "2026-09-14T19:29:07+05:30",
        picked_up_at: "2026-09-14T19:33:07+05:30",
        delivered_at: null,
      },
      delay_minutes_vs_final_eta: null,
      driver: { driver_id: "DRV-1187", name: "Ravi Kumar", vehicle: "scooter", rating: 4.7 },
      delivery: {
        type: "handover",
        address_label: "Home",
        otp_required: true,
        otp_entered: null,
        proof_of_delivery_photo: null,
      },
      notes_to_restaurant: "Extra coconut chutney, please",
      substitution: null,
      cancellation: null,
      refund: null,
      issues: [],
    },
  },
  {
    live: true,
    record: {
      order_id: "QB-2026-518772",
      customer_email: "arjun.mehta@example.com",
      customer_id: "CUST-002",
      restaurant: { name: "Tandoor Theory", cuisine: "North Indian", distance_km: 2.6 },
      items: [
        { name: "Paneer Butter Masala", quantity: 1, unit_price: 289, line_total: 289 },
        { name: "Garlic Naan", quantity: 2, unit_price: 65, line_total: 130 },
        { name: "Jeera Rice", quantity: 1, unit_price: 149, line_total: 149 },
        { name: "Boondi Raita", quantity: 1, unit_price: 79, line_total: 79 },
      ],
      subtotal: 647,
      discount: { promo_code: null, amount: 0.0 },
      fees: {
        delivery_fee: 35,
        surge_fee: 0,
        packaging_charge: 20,
        platform_fee: 6,
        small_order_fee: 0,
      },
      taxes: 32.0,
      total: 740.0,
      payment_method: "card",
      status: "delivered",
      timestamps: {
        placed_at: "2026-09-14T18:41:07+05:30",
        eta_at_checkout: "2026-09-14T19:22:07+05:30",
        accepted_at: "2026-09-14T18:42:07+05:30",
        final_eta: "2026-09-14T19:21:07+05:30",
        ready_for_pickup_at: "2026-09-14T19:03:07+05:30",
        picked_up_at: "2026-09-14T19:05:07+05:30",
        delivered_at: "2026-09-14T19:20:07+05:30",
      },
      delay_minutes_vs_final_eta: -1,
      driver: { driver_id: "DRV-2210", name: "Arjun Nair", vehicle: "bike", rating: 4.9 },
      delivery: {
        type: "contactless",
        address_label: "Work",
        otp_required: false,
        otp_entered: null,
        proof_of_delivery_photo: "pod/QB-2026-518772.jpg",
      },
      notes_to_restaurant: null,
      substitution: null,
      cancellation: null,
      refund: null,
      issues: [],
    },
  },
  {
    live: true,
    record: {
      order_id: "QB-2026-499203",
      customer_email: "priya.sharma@example.com",
      customer_id: "CUST-014",
      restaurant: { name: "Green Fork Salads", cuisine: "Salads & Bowls", distance_km: 4.1 },
      items: [
        { name: "Quinoa Power Bowl", quantity: 1, unit_price: 329, line_total: 329 },
        { name: "Green Goddess Salad", quantity: 1, unit_price: 279, line_total: 279 },
        { name: "Cold Pressed Orange", quantity: 1, unit_price: 129, line_total: 129 },
      ],
      subtotal: 737,
      discount: { promo_code: null, amount: 0.0 },
      fees: {
        delivery_fee: 35,
        surge_fee: 0,
        packaging_charge: 20,
        platform_fee: 6,
        small_order_fee: 0,
      },
      taxes: 37.0,
      total: 835.0,
      payment_method: "upi",
      status: "cancelled",
      timestamps: {
        placed_at: "2026-09-14T19:16:07+05:30",
        eta_at_checkout: "2026-09-14T19:56:07+05:30",
        accepted_at: "2026-09-14T19:18:07+05:30",
        final_eta: null,
        ready_for_pickup_at: null,
        picked_up_at: null,
        delivered_at: null,
        cancelled_at: "2026-09-14T19:28:07+05:30",
      },
      delay_minutes_vs_final_eta: null,
      driver: null,
      delivery: {
        type: "handover",
        address_label: "Home",
        otp_required: false,
        otp_entered: null,
        proof_of_delivery_photo: null,
      },
      notes_to_restaurant: null,
      substitution: null,
      cancellation: {
        cancelled_by: "restaurant",
        reason: "Quinoa Power Bowl was out of stock",
        cancelled_at: "2026-09-14T19:28:07+05:30",
      },
      refund: {
        status: "initiated",
        amount: 835.0,
        method: "upi",
        initiated_at: "2026-09-14T19:28:40+05:30",
        expected_by: "2026-09-17T19:28:40+05:30",
      },
      issues: [],
    },
  },
  {
    live: true,
    record: {
      order_id: "QB-2026-503420",
      customer_email: "arjun.mehta@example.com",
      customer_id: "CUST-002",
      restaurant: { name: "Ember Pizza Co.", cuisine: "Pizza", distance_km: 5.2 },
      items: [
        { name: "Margherita Pizza", quantity: 1, unit_price: 349, line_total: 349 },
        { name: "Garlic Breadsticks", quantity: 1, unit_price: 169, line_total: 169 },
        { name: "Masala Lemonade", quantity: 2, unit_price: 99, line_total: 198 },
      ],
      subtotal: 716,
      discount: { promo_code: null, amount: 0.0 },
      fees: {
        delivery_fee: 45,
        surge_fee: 25,
        packaging_charge: 25,
        platform_fee: 6,
        small_order_fee: 0,
      },
      taxes: 36.0,
      total: 853.0,
      payment_method: "wallet",
      status: "preparing",
      timestamps: {
        placed_at: "2026-09-14T19:33:07+05:30",
        eta_at_checkout: "2026-09-14T20:15:07+05:30",
        accepted_at: "2026-09-14T19:35:07+05:30",
        final_eta: "2026-09-14T20:11:07+05:30",
        ready_for_pickup_at: null,
        picked_up_at: null,
        delivered_at: null,
      },
      delay_minutes_vs_final_eta: null,
      driver: null,
      delivery: {
        type: "handover",
        address_label: "Home",
        otp_required: true,
        otp_entered: null,
        proof_of_delivery_photo: null,
      },
      notes_to_restaurant: null,
      substitution: null,
      cancellation: null,
      refund: null,
      issues: [],
    },
  },
  {
    live: true,
    record: {
      order_id: "QB-2026-471055",
      customer_email: "priya.sharma@example.com",
      customer_id: "CUST-014",
      restaurant: { name: "Saffron Lane Biryani", cuisine: "Biryani", distance_km: 3.9 },
      items: [
        { name: "Hyderabadi Chicken Biryani", quantity: 2, unit_price: 329, line_total: 658 },
        { name: "Mirchi Ka Salan", quantity: 1, unit_price: 89, line_total: 89 },
        { name: "Double Ka Meetha", quantity: 1, unit_price: 119, line_total: 119 },
      ],
      subtotal: 866,
      discount: { promo_code: null, amount: 0.0 },
      fees: {
        delivery_fee: 35,
        surge_fee: 0,
        packaging_charge: 30,
        platform_fee: 6,
        small_order_fee: 0,
      },
      taxes: 43.0,
      total: 980.0,
      payment_method: "upi",
      status: "delivered",
      timestamps: {
        placed_at: "2026-09-13T19:52:07+05:30",
        eta_at_checkout: "2026-09-13T20:37:07+05:30",
        accepted_at: "2026-09-13T19:54:07+05:30",
        final_eta: "2026-09-13T20:34:07+05:30",
        ready_for_pickup_at: "2026-09-13T20:14:07+05:30",
        picked_up_at: "2026-09-13T20:18:07+05:30",
        delivered_at: "2026-09-13T20:33:07+05:30",
      },
      delay_minutes_vs_final_eta: -1,
      driver: { driver_id: "DRV-3021", name: "Suresh Babu", vehicle: "bike", rating: 4.6 },
      delivery: {
        type: "handover",
        address_label: "Home",
        otp_required: false,
        otp_entered: null,
        proof_of_delivery_photo: null,
      },
      notes_to_restaurant: null,
      substitution: null,
      cancellation: null,
      refund: null,
      issues: [],
    },
  },
  {
    live: true,
    record: {
      order_id: "QB-2026-522604",
      customer_email: "priya.sharma@example.com",
      customer_id: "CUST-014",
      restaurant: { name: "Noodle Bar 88", cuisine: "Asian", distance_km: 2.2 },
      items: [
        { name: "Veg Hakka Noodles", quantity: 1, unit_price: 219, line_total: 219 },
        { name: "Chilli Paneer", quantity: 1, unit_price: 259, line_total: 259 },
      ],
      subtotal: 478,
      discount: { promo_code: null, amount: 0.0 },
      fees: {
        delivery_fee: 35,
        surge_fee: 0,
        packaging_charge: 15,
        platform_fee: 6,
        small_order_fee: 0,
      },
      taxes: 24.0,
      total: 558.0,
      payment_method: "upi",
      status: "accepted",
      timestamps: {
        placed_at: "2026-09-14T19:39:07+05:30",
        eta_at_checkout: "2026-09-14T20:16:07+05:30",
        accepted_at: "2026-09-14T19:41:07+05:30",
        final_eta: "2026-09-14T20:16:07+05:30",
        ready_for_pickup_at: null,
        picked_up_at: null,
        delivered_at: null,
      },
      delay_minutes_vs_final_eta: null,
      driver: null,
      delivery: {
        type: "handover",
        address_label: "Home",
        otp_required: false,
        otp_entered: null,
        proof_of_delivery_photo: null,
      },
      notes_to_restaurant: null,
      substitution: null,
      cancellation: null,
      refund: null,
      issues: [],
    },
  },
  {
    // A real sample record from the order service, unshifted.
    live: false,
    record: {
      order_id: "QB-2026-398971",
      customer_email: "arjun.mehta@example.com",
      customer_id: "CUST-002",
      restaurant: { name: "Chai Point Cafe", cuisine: "Cafe", distance_km: 1.8 },
      items: [
        { name: "Blueberry Muffin", quantity: 1, unit_price: 140, line_total: 140 },
        { name: "Cappuccino", quantity: 1, unit_price: 160, line_total: 160 },
      ],
      subtotal: 300,
      discount: { promo_code: null, amount: 0.0 },
      fees: {
        delivery_fee: 0,
        surge_fee: 25,
        packaging_charge: 20,
        platform_fee: 6,
        small_order_fee: 0,
      },
      taxes: 15.0,
      total: 366.0,
      payment_method: "upi",
      status: "delivered",
      timestamps: {
        placed_at: "2026-08-12T00:30:00+05:30",
        eta_at_checkout: "2026-08-12T01:05:00+05:30",
        accepted_at: "2026-08-12T00:33:00+05:30",
        final_eta: "2026-08-12T01:08:00+05:30",
        ready_for_pickup_at: "2026-08-12T00:47:00+05:30",
        picked_up_at: "2026-08-12T00:52:00+05:30",
        delivered_at: "2026-08-12T01:05:00+05:30",
      },
      delay_minutes_vs_final_eta: -3,
      driver: { driver_id: "DRV-2402", name: "Naveen Raj", vehicle: "bike", rating: 4.8 },
      delivery: {
        type: "handover",
        address_label: "Home",
        otp_required: false,
        otp_entered: null,
        proof_of_delivery_photo: null,
      },
      notes_to_restaurant: null,
      substitution: null,
      cancellation: null,
      refund: null,
      issues: [],
    },
  },
];

export const ORDERS_BY_ID: ReadonlyMap<string, FixtureOrder> = new Map(
  ORDERS.map((order) => [order.record.order_id, order]),
);

/** Accepts "qb-2026-481213", "QB 2026 481213", "#QB2026481213" and normalises to "QB-2026-481213". */
export function normalizeOrderId(raw: string): string | null {
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const match = /^QB(\d{4})(\d{6})$/.exec(compact);
  return match ? `QB-${match[1]}-${match[2]}` : null;
}

export function findOrder(rawId: string): FixtureOrder | null {
  const id = normalizeOrderId(rawId);
  return id ? (ORDERS_BY_ID.get(id) ?? null) : null;
}

/** Format an instant as the order service does: second precision with an IST offset. */
function toIstIso(ms: number): string {
  return `${new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 19)}+05:30`;
}

function shiftTime(value: string, shiftMs: number): string {
  const time = Date.parse(value);
  return Number.isNaN(time) || shiftMs === 0 ? value : toIstIso(time + shiftMs);
}

function shiftNullable(value: string | null | undefined, shiftMs: number): string | null {
  return value ? shiftTime(value, shiftMs) : null;
}

/** Shift any `*_at` / `*_by` date strings inside a free-form record such as a refund. */
function shiftRecordTimes(
  record: Record<string, unknown> | null | undefined,
  shiftMs: number,
): Record<string, unknown> | null {
  if (!record) return null;
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      typeof value === "string" && /_(at|by)$/.test(key) ? shiftTime(value, shiftMs) : value,
    ]),
  );
}

/** Materialise a fixture into the API response shape. Customer identifiers never leave this function. */
export function toApiOrder(fixture: FixtureOrder, now: Date): Order {
  const source = fixture.record;
  const shiftMs = fixture.live ? now.getTime() - ANCHOR_MS : 0;
  const t = source.timestamps;

  return {
    order_id: source.order_id,
    status: source.status,
    restaurant: source.restaurant,
    items: source.items,
    subtotal: source.subtotal,
    discount: source.discount,
    fees: source.fees,
    taxes: source.taxes,
    total: source.total,
    payment_method: source.payment_method,
    timestamps: {
      placed_at: shiftTime(t.placed_at, shiftMs),
      eta_at_checkout: shiftNullable(t.eta_at_checkout, shiftMs),
      accepted_at: shiftNullable(t.accepted_at, shiftMs),
      final_eta: shiftNullable(t.final_eta, shiftMs),
      ready_for_pickup_at: shiftNullable(t.ready_for_pickup_at, shiftMs),
      picked_up_at: shiftNullable(t.picked_up_at, shiftMs),
      delivered_at: shiftNullable(t.delivered_at, shiftMs),
      cancelled_at: shiftNullable(t.cancelled_at, shiftMs),
    },
    delay_minutes_vs_final_eta: source.delay_minutes_vs_final_eta,
    driver: source.driver,
    delivery: source.delivery,
    notes_to_restaurant: source.notes_to_restaurant,
    substitution: source.substitution,
    cancellation: shiftRecordTimes(source.cancellation, shiftMs),
    refund: shiftRecordTimes(source.refund, shiftMs),
    issues: source.issues,
  };
}

/* Customers ------------------------------------------------------------------------------------*/

export interface FixtureCustomer {
  customer_id: string;
  email: string;
  name: string;
}

/** Demo accounts for email sign-in. Every order above belongs to one of them. */
export const CUSTOMERS: readonly FixtureCustomer[] = [
  { customer_id: "CUST-014", email: "priya.sharma@example.com", name: "Priya Sharma" },
  { customer_id: "CUST-002", email: "arjun.mehta@example.com", name: "Arjun Mehta" },
];

export function findCustomer(email: string): FixtureCustomer | null {
  const normalized = email.trim().toLowerCase();
  return CUSTOMERS.find((customer) => customer.email === normalized) ?? null;
}

/** One customer's orders, newest first. */
export function ordersForCustomer(email: string): FixtureOrder[] {
  const normalized = email.trim().toLowerCase();
  return ORDERS.filter((order) => order.record.customer_email === normalized).sort(
    (a, b) => Date.parse(b.record.timestamps.placed_at) - Date.parse(a.record.timestamps.placed_at),
  );
}
