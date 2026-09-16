import {
  ArrowRight,
  Bike,
  CircleCheck,
  Clock,
  CreditCard,
  House,
  Receipt,
  Star,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Eyebrow, Surface } from "@/components/ui/primitives";
import { Timeline } from "@/components/ui/timeline";
import type { TimelineStep } from "@/components/ui/timeline";
import type { Order } from "@/lib/api";
import { formatAmount, formatClock } from "@/lib/format";
import {
  describeIssue,
  firstName,
  humanize,
  lineTotal,
  orderCharges,
  orderStages,
  orderStatusMeta,
  orderTiming,
  readNumber,
  readString,
} from "@/lib/order-view";

function paymentLabel(method: string): string {
  return method.length <= 4 ? method.toUpperCase() : humanize(method);
}

export function OrderCard({
  order,
  referenceTime,
  compact = false,
}: {
  order: Order;
  /** When the order was fetched; "minutes away" is measured from here. */
  referenceTime: string;
  /** Compact: header and status only, with a link to the full order page. */
  compact?: boolean;
}) {
  const status = orderStatusMeta(order.status);
  const currency = order.currency ?? "INR";

  return (
    <Surface level={2} className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="outline" size="sm" mono>
              {order.order_id}
            </Badge>
            <span className="text-2xs text-fg-subtle">
              Placed {formatClock(order.timestamps.placed_at)}
            </span>
          </div>
          <p className="mt-1.5 font-display-tight text-lg font-medium leading-tight text-fg">
            {order.restaurant.name}
          </p>
          {order.restaurant.cuisine || order.restaurant.distance_km != null ? (
            <p className="text-xs text-fg-subtle">
              {[
                order.restaurant.cuisine,
                order.restaurant.distance_km != null
                  ? `${order.restaurant.distance_km} km away`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      <StatusStrip order={order} referenceTime={referenceTime} currency={currency} />

      {compact ? (
        <Link
          href={`/orders/${encodeURIComponent(order.order_id)}`}
          className="flex items-center justify-between gap-3 px-4 py-3 text-[0.8125rem] font-medium text-brand-ink transition-colors hover:bg-surface-3 sm:px-5"
        >
          View items, charges, and timeline
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      ) : (
        <OrderBody order={order} currency={currency} />
      )}
    </Surface>
  );
}

function OrderBody({ order, currency }: { order: Order; currency: string }) {
  const steps: TimelineStep[] = orderStages(order).map((stage) => ({
    id: stage.id,
    title: stage.label,
    meta: stage.at
      ? formatClock(stage.at)
      : stage.expectedAt
        ? `ETA ${formatClock(stage.expectedAt)}`
        : undefined,
    state: stage.state,
    tone: stage.tone,
  }));
  const issues = (order.issues ?? [])
    .map(describeIssue)
    .filter((issue): issue is string => issue !== null);

  return (
    <>
      <div className="grid gap-6 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] sm:px-5">
        <section aria-label="Order progress">
          <Eyebrow className="mb-3">Progress</Eyebrow>
          <Timeline steps={steps} />
        </section>
        <section aria-label="Items and total">
          <Eyebrow className="mb-3">Items</Eyebrow>
          <ul className="flex flex-col gap-2">
            {order.items.map((item, index) => (
              <li
                key={`${item.name}-${index}`}
                className="flex items-baseline justify-between gap-3 text-[0.8125rem]"
              >
                <span className="min-w-0">
                  <span className="mr-1.5 font-mono text-2xs text-fg-subtle">{item.quantity}×</span>
                  <span className="text-fg">{item.name}</span>
                </span>
                <span className="shrink-0 font-mono text-xs tabular text-fg-muted">
                  {formatAmount(lineTotal(item), currency)}
                </span>
              </li>
            ))}
          </ul>
          <dl className="mt-3.5 flex flex-col gap-1 border-t border-line pt-3 text-xs">
            {orderCharges(order).map((line) => (
              <div key={line.label} className="flex justify-between gap-3 text-fg-subtle">
                <dt>{line.label}</dt>
                <dd className="font-mono tabular">
                  {line.negative ? "−" : ""}
                  {formatAmount(line.amount, currency)}
                </dd>
              </div>
            ))}
            <div className="mt-1 flex justify-between gap-3 text-[0.8125rem] font-medium text-fg">
              <dt>Total</dt>
              <dd className="font-mono tabular">{formatAmount(order.total, currency)}</dd>
            </div>
          </dl>
        </section>
      </div>

      {issues.length > 0 || order.notes_to_restaurant ? (
        <div className="flex flex-col gap-1 border-t border-line px-4 py-2.5 text-xs text-fg-muted sm:px-5">
          {order.notes_to_restaurant ? (
            <p>Note to restaurant: “{order.notes_to_restaurant}”</p>
          ) : null}
          {issues.map((issue) => (
            <p key={issue}>Reported issue: {issue}</p>
          ))}
        </div>
      ) : null}

      {order.driver || order.payment_method || order.delivery?.address_label ? (
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 border-t border-line px-4 py-2.5 text-2xs text-fg-subtle sm:px-5">
          {order.driver ? (
            <span className="inline-flex items-center gap-1.5">
              <Bike className="size-3.5" aria-hidden />
              {firstName(order.driver.name)}
              {order.driver.vehicle ? ` · ${humanize(order.driver.vehicle)}` : ""}
              {order.driver.rating != null ? (
                <span className="inline-flex items-center gap-0.5">
                  <Star className="size-3 fill-current text-brand-ink" aria-hidden />
                  <span className="sr-only">rated</span>
                  {order.driver.rating.toFixed(1)}
                </span>
              ) : null}
            </span>
          ) : null}
          {order.payment_method ? (
            <span className="inline-flex items-center gap-1.5">
              <CreditCard className="size-3.5" aria-hidden />
              {paymentLabel(order.payment_method)}
            </span>
          ) : null}
          {order.delivery?.address_label ? (
            <span className="inline-flex items-center gap-1.5">
              <House className="size-3.5" aria-hidden />
              {order.delivery.address_label}
              {order.delivery.type ? ` · ${humanize(order.delivery.type)}` : ""}
            </span>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function StatusStrip({
  order,
  referenceTime,
  currency,
}: {
  order: Order;
  referenceTime: string;
  currency: string;
}) {
  const timing = orderTiming(order, Date.parse(referenceTime));

  if (order.status === "cancelled") {
    const by =
      readString(order.cancellation, "cancelled_by") ?? readString(order.cancellation, "by");
    const reason = readString(order.cancellation, "reason");
    const refundAmount = readNumber(order.refund, "amount");
    const refundStatus = readString(order.refund, "status");
    const refundMethod = readString(order.refund, "method");
    return (
      <div className="flex flex-col gap-1 border-b border-line bg-danger-soft px-4 py-3 sm:px-5">
        <p className="text-[0.8125rem] text-fg">
          Cancelled{by ? ` by the ${by === "quickbite" ? "platform" : by}` : ""}
          {reason ? <span className="text-fg-muted"> · {reason}</span> : null}
        </p>
        {refundAmount != null ? (
          <p className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
            <Receipt className="size-3.5" aria-hidden />
            <span className="font-mono tabular text-fg">
              {formatAmount(refundAmount, currency)}
            </span>{" "}
            refund
            {refundStatus ? ` ${refundStatus}` : ""}
            {refundMethod ? ` to ${paymentLabel(refundMethod)}` : ""}
          </p>
        ) : null}
      </div>
    );
  }

  if (order.status === "delivered") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-sunken px-4 py-3 sm:px-5">
        <p className="text-[0.8125rem] text-fg-muted">
          Delivered <span className="text-fg">{formatClock(order.timestamps.delivered_at)}</span>
        </p>
        <LatenessBadge minutesVsPromise={timing.minutesVsPromise} />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line bg-sunken px-4 py-3 sm:px-5">
      {timing.isOverdue ? (
        <p className="text-[0.8125rem] font-medium text-danger">Past the latest estimate</p>
      ) : null}
      {timing.minutesRemaining != null ? (
        <p className="flex items-baseline gap-1.5">
          <span className="font-display-tight text-[1.75rem] font-medium leading-none tabular text-fg">
            {timing.minutesRemaining}
          </span>
          <span className="text-[0.8125rem] text-fg-muted">min away</span>
        </p>
      ) : null}
      <dl className="flex gap-5 text-xs">
        {order.timestamps.final_eta ? (
          <div>
            <dt className="text-fg-subtle">Latest ETA</dt>
            <dd className="font-mono tabular text-fg">{formatClock(order.timestamps.final_eta)}</dd>
          </div>
        ) : null}
        {timing.promisedAt ? (
          <div>
            <dt className="text-fg-subtle">Promised at checkout</dt>
            <dd className="font-mono tabular text-fg">{formatClock(timing.promisedAt)}</dd>
          </div>
        ) : null}
      </dl>
      <LatenessBadge minutesVsPromise={timing.minutesVsPromise} className="ml-auto" />
    </div>
  );
}

function LatenessBadge({
  minutesVsPromise,
  className,
}: {
  minutesVsPromise: number | null;
  className?: string;
}) {
  if (minutesVsPromise === null) return null;
  return minutesVsPromise > 0 ? (
    <Badge tone="danger" className={className}>
      <Clock aria-hidden />
      {minutesVsPromise} min late
    </Badge>
  ) : (
    <Badge tone="success" className={className}>
      <CircleCheck aria-hidden />
      {minutesVsPromise < 0 ? `${Math.abs(minutesVsPromise)} min early` : "On time"}
    </Badge>
  );
}
