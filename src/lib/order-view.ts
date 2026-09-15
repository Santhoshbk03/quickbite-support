/**
 * View-model helpers for an order from the API.
 *
 * The backend passes the order service's record through as stored (timestamps, fees, driver), so the
 * timeline, lateness, and charge lines are derived here instead of being precomputed server-side.
 * Shared by the order card and by the mock's answer composition, so both tell the same story.
 */
import type { Order } from "@/lib/api/types";

export type OrderTone = "neutral" | "brand" | "success" | "danger" | "info";

const STATUS_META: Record<string, { label: string; tone: OrderTone }> = {
  placed: { label: "Placed", tone: "neutral" },
  accepted: { label: "Accepted", tone: "info" },
  confirmed: { label: "Confirmed", tone: "info" },
  preparing: { label: "Being prepared", tone: "info" },
  ready_for_pickup: { label: "Ready for pickup", tone: "info" },
  picked_up: { label: "On the way", tone: "brand" },
  out_for_delivery: { label: "On the way", tone: "brand" },
  delivered: { label: "Delivered", tone: "success" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

const ACTIVE_STATUSES: ReadonlySet<string> = new Set([
  "placed",
  "accepted",
  "confirmed",
  "preparing",
  "ready_for_pickup",
  "picked_up",
  "out_for_delivery",
]);

export function humanize(value: string): string {
  const text = value.replace(/[_-]+/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Unknown statuses still render, humanised, rather than breaking the card. */
export function orderStatusMeta(status: string): { label: string; tone: OrderTone } {
  return STATUS_META[status] ?? { label: humanize(status), tone: "neutral" };
}

export function isActiveOrder(status: string): boolean {
  return ACTIVE_STATUSES.has(status);
}

/** The record carries the driver's full name; the interface only ever shows the first. */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

export function readString(
  record: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  const value = record?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function readNumber(
  record: Record<string, unknown> | null | undefined,
  key: string,
): number | null {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

/* Stages ---------------------------------------------------------------------------------------*/

export interface OrderStage {
  id: string;
  label: string;
  at: string | null;
  /** For the in-progress stage: when it is expected to finish. */
  expectedAt: string | null;
  state: "complete" | "current" | "upcoming";
  tone: "default" | "danger";
}

export function orderStages(order: Order): OrderStage[] {
  const t = order.timestamps;
  const rider = order.driver ? firstName(order.driver.name) : null;

  const stages = [
    { id: "placed", done: "Order placed", doing: "Placing order", at: t.placed_at },
    {
      id: "accepted",
      done: "Restaurant accepted",
      doing: "Waiting for the restaurant",
      at: t.accepted_at ?? null,
    },
    {
      id: "ready",
      done: "Ready for pickup",
      doing: "Being prepared",
      at: t.ready_for_pickup_at ?? null,
    },
    {
      id: "picked_up",
      done: rider ? `Picked up by ${rider}` : "Picked up",
      doing: "Waiting for a rider",
      at: t.picked_up_at ?? null,
    },
    {
      id: "delivered",
      done: "Delivered",
      doing: rider ? `On the way with ${rider}` : "On the way",
      at: t.delivered_at ?? null,
    },
  ];

  if (order.status === "cancelled") {
    const cancelledAt = t.cancelled_at ?? readString(order.cancellation, "cancelled_at");
    return [
      ...stages
        .filter((stage) => stage.at)
        .map((stage) => ({
          id: stage.id,
          label: stage.done,
          at: stage.at,
          expectedAt: null,
          state: "complete" as const,
          tone: "default" as const,
        })),
      {
        id: "cancelled",
        label: "Cancelled",
        at: cancelledAt,
        expectedAt: null,
        state: "current",
        tone: "danger",
      },
    ];
  }

  const active = isActiveOrder(order.status);
  const firstPending = stages.findIndex((stage) => !stage.at);

  return stages.map((stage, index) => {
    const isCurrent = active && index === firstPending;
    return {
      id: stage.id,
      label: stage.at ? stage.done : isCurrent ? stage.doing : stage.done,
      at: stage.at,
      expectedAt: isCurrent && stage.id === "delivered" ? (t.final_eta ?? null) : null,
      state: stage.at ? "complete" : isCurrent ? "current" : "upcoming",
      tone: "default",
    };
  });
}

/* Timing ---------------------------------------------------------------------------------------*/

export interface OrderTiming {
  /** The ETA shown at checkout: the promise late-delivery credits are measured against. */
  promisedAt: string | null;
  /** Actual delivery time, or the latest estimate while the order is active. */
  estimateAt: string | null;
  /** Positive when later than promised, negative when early; null when either time is unknown. */
  minutesVsPromise: number | null;
  isLate: boolean;
  minutesRemaining: number | null;
  minutesSinceDelivery: number | null;
}

export function orderTiming(order: Order, reference: number): OrderTiming {
  const t = order.timestamps;
  const promised = parseTime(t.eta_at_checkout);
  const delivered = parseTime(t.delivered_at);
  const finalEta = parseTime(t.final_eta);
  const estimate = delivered ?? finalEta;
  const minutesVsPromise =
    promised !== null && estimate !== null ? Math.round((estimate - promised) / 60_000) : null;

  return {
    promisedAt: t.eta_at_checkout ?? null,
    estimateAt: t.delivered_at ?? t.final_eta ?? null,
    minutesVsPromise,
    isLate: minutesVsPromise !== null && minutesVsPromise > 0,
    minutesRemaining:
      isActiveOrder(order.status) && finalEta !== null
        ? Math.max(1, Math.round((finalEta - reference) / 60_000))
        : null,
    minutesSinceDelivery:
      delivered !== null ? Math.max(0, Math.round((reference - delivered) / 60_000)) : null,
  };
}

/* Charges --------------------------------------------------------------------------------------*/

export interface ChargeLine {
  label: string;
  amount: number;
  negative?: boolean;
}

const FEE_LABELS = [
  ["delivery_fee", "Delivery fee"],
  ["surge_fee", "Surge"],
  ["packaging_charge", "Packaging"],
  ["platform_fee", "Platform fee"],
  ["small_order_fee", "Small-order fee"],
] as const;

export function orderCharges(order: Order): ChargeLine[] {
  const lines: ChargeLine[] = [];
  if (order.subtotal != null) lines.push({ label: "Subtotal", amount: order.subtotal });
  for (const [key, label] of FEE_LABELS) {
    const amount = order.fees?.[key];
    if (amount) lines.push({ label, amount });
  }
  if (order.taxes) lines.push({ label: "Taxes", amount: order.taxes });
  if (order.discount?.amount) {
    lines.push({
      label: order.discount.promo_code ? `Discount · ${order.discount.promo_code}` : "Discount",
      amount: order.discount.amount,
      negative: true,
    });
  }
  return lines;
}

export function lineTotal(item: Order["items"][number]): number {
  return item.line_total ?? item.unit_price * item.quantity;
}

/** Issues have no fixed shape yet; show whatever human-readable text an entry carries. */
export function describeIssue(issue: unknown): string | null {
  if (typeof issue === "string") return issue;
  if (issue && typeof issue === "object") {
    const record = issue as Record<string, unknown>;
    return (
      readString(record, "description") ??
      readString(record, "summary") ??
      readString(record, "type")
    );
  }
  return null;
}
