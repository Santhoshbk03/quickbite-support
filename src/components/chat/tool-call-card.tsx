"use client";

import {
  Bike,
  ChevronDown,
  CircleCheck,
  Clock,
  CreditCard,
  House,
  Receipt,
  SearchX,
  Star,
  Terminal,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Eyebrow, Skeleton, Surface } from "@/components/ui/primitives";
import { Timeline } from "@/components/ui/timeline";
import type { TimelineStep } from "@/components/ui/timeline";
import { isLookupOrderCall } from "@/lib/api";
import type { LookupOrderResult } from "@/lib/api";
import type { ToolCallView } from "@/lib/chat/types";
import { formatAmount, formatClock, formatMs } from "@/lib/format";
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

export function ToolCallCard({
  call,
  referenceTime,
}: {
  call: ToolCallView;
  referenceTime: string;
}) {
  const result = call.result;
  if (!result) return <ToolRunning call={call} />;

  if (isLookupOrderCall(result)) {
    if (result.status === "success" && result.result) {
      return <OrderCard order={result.result} call={call} referenceTime={referenceTime} />;
    }
    return <ToolFailure call={call} code={result.error?.code} message={result.error?.message} />;
  }

  return <GenericToolCard call={call} />;
}

/* Running --------------------------------------------------------------------------------------*/

function ToolRunning({ call }: { call: ToolCallView }) {
  const orderId =
    typeof call.arguments["order_id"] === "string" ? call.arguments["order_id"] : null;
  return (
    <Surface level={2} className="overflow-hidden" aria-busy="true">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3.5 sm:px-5">
        <span className="relative flex size-2 shrink-0">
          <span className="absolute inset-0 rounded-full bg-brand opacity-60 motion-safe:animate-ping" />
          <span className="relative size-2 rounded-full bg-brand" />
        </span>
        <p className="text-[0.8125rem] text-fg-muted">
          {orderId ? (
            <>
              Looking up order <span className="font-mono text-fg">{orderId}</span>…
            </>
          ) : (
            <>
              Running <span className="font-mono text-fg">{call.name}</span>…
            </>
          )}
        </p>
      </div>
      {/* Reserves roughly the order card's height so the answer below does not jump when it lands. */}
      <div className="grid gap-5 px-4 py-4 sm:min-h-[15rem] sm:grid-cols-2 sm:px-5" aria-hidden>
        <div className="flex flex-col gap-3">
          {[64, 52, 70, 45].map((width) => (
            <div key={width} className="flex items-center gap-3">
              <Skeleton className="size-5 rounded-full" />
              <Skeleton className="h-3.5" style={{ width: `${width}%` }} />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2.5">
          {[80, 66, 72, 40].map((width) => (
            <Skeleton key={width} className="h-3.5" style={{ width: `${width}%` }} />
          ))}
        </div>
      </div>
    </Surface>
  );
}

/* Order card -----------------------------------------------------------------------------------*/

export function OrderCard({
  order,
  call,
  referenceTime,
}: {
  order: LookupOrderResult;
  call?: ToolCallView;
  /** When the lookup happened; relative times are computed against it, not against "now". */
  referenceTime: string;
}) {
  const status = orderStatusMeta(order.status);
  const currency = order.currency ?? "INR";
  const stages = orderStages(order);
  const charges = orderCharges(order);
  const issues = (order.issues ?? [])
    .map(describeIssue)
    .filter((issue): issue is string => !!issue);

  const steps: TimelineStep[] = stages.map((stage) => ({
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
            {charges.map((line) => (
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
              {order.payment_method.length <= 4
                ? order.payment_method.toUpperCase()
                : humanize(order.payment_method)}
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

      {call ? <ToolInvocation call={call} /> : null}
    </Surface>
  );
}

function StatusStrip({
  order,
  referenceTime,
  currency,
}: {
  order: LookupOrderResult;
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
            {refundMethod
              ? ` to ${refundMethod.length <= 4 ? refundMethod.toUpperCase() : refundMethod}`
              : ""}
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
          {timing.minutesSinceDelivery !== null && timing.minutesSinceDelivery < 180
            ? ` · ${timing.minutesSinceDelivery} min before this lookup`
            : ""}
        </p>
        <LatenessBadge minutesVsPromise={timing.minutesVsPromise} />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line bg-sunken px-4 py-3 sm:px-5">
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

/* Failure and generic tools --------------------------------------------------------------------*/

function ToolFailure({
  call,
  code,
  message,
}: {
  call: ToolCallView;
  code?: string;
  message?: string;
}) {
  return (
    <Surface level={1} className="overflow-hidden">
      <div className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-3 text-fg-muted">
          <SearchX className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[0.8125rem] font-medium text-fg">The lookup didn’t return an order</p>
          <p className="mt-0.5 text-xs text-fg-subtle">
            {message ?? "The tool reported an error."}
          </p>
          {code ? <p className="mt-1 font-mono text-2xs text-fg-subtle">{code}</p> : null}
        </div>
      </div>
      <ToolInvocation call={call} />
    </Surface>
  );
}

function GenericToolCard({ call }: { call: ToolCallView }) {
  return (
    <Surface level={1} className="overflow-hidden">
      <p className="px-4 py-3 text-[0.8125rem] text-fg-muted sm:px-5">
        Used <span className="font-mono text-fg">{call.name}</span>
      </p>
      <ToolInvocation call={call} defaultOpen />
    </Surface>
  );
}

/* Raw invocation affordance --------------------------------------------------------------------*/

export function ToolInvocation({
  call,
  defaultOpen = false,
}: {
  call: ToolCallView;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const reduceMotion = useReducedMotion();
  const regionId = useId();
  const args = Object.entries(call.arguments)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(", ");
  const payload = call.result
    ? {
        name: call.result.name,
        arguments: call.result.arguments,
        status: call.result.status,
        duration_ms: call.result.duration_ms ?? null,
        ...(call.result.status === "success"
          ? { result: call.result.result }
          : { error: call.result.error }),
      }
    : { name: call.name, arguments: call.arguments, status: "running" };

  return (
    <div className="border-t border-line">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={regionId}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left font-mono text-2xs text-fg-subtle outline-none transition-colors hover:bg-surface-3 hover:text-fg-muted focus-visible:bg-surface-3 sm:px-5"
      >
        <Terminal className="size-3.5 shrink-0" aria-hidden />
        <span className="min-w-0 truncate">
          called <span className="text-brand-ink">{call.name}</span>({args})
        </span>
        {call.result?.duration_ms != null ? (
          <span className="ml-auto shrink-0 tabular">{formatMs(call.result.duration_ms)}</span>
        ) : (
          <span className="ml-auto" />
        )}
        <ChevronDown
          className={`size-3.5 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={regionId}
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <pre className="scrollbar-thin max-h-80 overflow-auto border-t border-line bg-sunken px-4 py-3.5 font-mono text-2xs leading-relaxed text-fg-muted sm:px-5">
              {JSON.stringify(payload, null, 2)}
            </pre>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
