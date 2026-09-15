"use client";

import { ChevronRight, Package } from "lucide-react";
import Link from "next/link";

import { EmptyState, EndpointTag, ErrorState } from "@/components/site/page-states";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/primitives";
import { useApiQuery } from "@/hooks/use-api-query";
import { api } from "@/lib/api";
import { formatAmount } from "@/lib/format";
import { orderStatusMeta } from "@/lib/order-view";

const placedFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function OrdersList() {
  const query = useApiQuery("orders", () => api.listOrders());

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-6">
        <EndpointTag method="GET" path="/orders" />
        <h1 className="mt-3 font-display-tight text-3xl font-medium text-fg">Your orders</h1>
        <p className="mt-1.5 text-sm text-fg-muted">
          Open an order to see its timeline and charges, or ask support about it.
        </p>
      </header>

      {query.status === "loading" ? (
        <ul className="flex flex-col gap-2" aria-label="Loading orders">
          {[0, 1, 2, 3].map((key) => (
            <li key={key}>
              <Skeleton className="h-[76px] rounded-lg" />
            </li>
          ))}
        </ul>
      ) : query.status === "error" ? (
        <ErrorState
          title="Couldn't load your orders"
          message={query.error.message}
          onRetry={query.retry}
        />
      ) : query.data.length === 0 ? (
        <EmptyState icon={<Package aria-hidden />} title="No orders yet" />
      ) : (
        <ul className="flex flex-col gap-2">
          {query.data.map((order) => {
            const status = orderStatusMeta(order.status);
            const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
            return (
              <li key={order.order_id}>
                <Link
                  href={`/orders/${encodeURIComponent(order.order_id)}`}
                  className="group flex items-center gap-4 rounded-lg border border-line bg-surface-1 px-4 py-3.5 shadow-1 transition-colors hover:border-line-strong hover:bg-surface-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <span className="font-medium text-fg">{order.restaurant.name}</span>
                      <Badge tone={status.tone} size="sm">
                        {status.label}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-fg-subtle">
                      <span className="font-mono">{order.order_id}</span> ·{" "}
                      {placedFormatter.format(new Date(order.timestamps.placed_at))} · {itemCount}{" "}
                      {itemCount === 1 ? "item" : "items"}
                    </p>
                  </div>
                  <span className="font-mono text-sm tabular text-fg">
                    {formatAmount(order.total, order.currency ?? "INR")}
                  </span>
                  <ChevronRight
                    className="size-4 text-fg-subtle transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
