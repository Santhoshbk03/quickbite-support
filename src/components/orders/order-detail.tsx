"use client";

import { ArrowLeft, MessagesSquare, SearchX } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { EmptyState, ErrorState } from "@/components/site/page-states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/primitives";
import { useApiQuery } from "@/hooks/use-api-query";
import { api } from "@/lib/api";
import { useChatStore } from "@/lib/chat/store";
import { OrderCard } from "./order-card";

export function OrderDetail({ orderId }: { orderId: string }) {
  const router = useRouter();
  const startConversation = useChatStore((state) => state.startConversation);
  const query = useApiQuery(`order:${orderId}`, () => api.getOrder(orderId));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Link
        href="/orders"
        className="inline-flex items-center gap-1.5 text-[0.8125rem] text-fg-muted hover:text-fg"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All orders
      </Link>

      <header className="mb-6 mt-4">
        <h1 className="font-display-tight text-3xl font-medium text-fg">Order {orderId}</h1>
      </header>

      {query.status === "loading" ? (
        <Skeleton className="h-[420px] rounded-lg" />
      ) : query.status === "error" ? (
        query.error.status === 404 ? (
          <EmptyState
            icon={<SearchX aria-hidden />}
            title="Order not found"
            description={`There is no order with the ID ${orderId}.`}
            action={
              <Link href="/orders" className="text-sm font-medium text-brand-ink hover:underline">
                Back to your orders
              </Link>
            }
          />
        ) : (
          <ErrorState
            title="Couldn't load this order"
            message={query.error.message}
            onRetry={query.retry}
          />
        )
      ) : (
        <div className="flex flex-col gap-4">
          <OrderCard order={query.data} referenceTime={new Date(query.loadedAt).toISOString()} />
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-1 p-4">
            <p className="min-w-0 flex-1 text-sm text-fg-muted">Something wrong with this order?</p>
            <Button
              variant="primary"
              onClick={() => {
                void startConversation(`I need help with my order ${query.data.order_id}.`);
                router.push("/");
              }}
            >
              <MessagesSquare aria-hidden />
              Ask support
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
