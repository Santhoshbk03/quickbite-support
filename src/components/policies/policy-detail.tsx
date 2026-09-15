"use client";

import { ArrowLeft, FileText, MessagesSquare } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { EmptyState, EndpointTag, ErrorState } from "@/components/site/page-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/primitives";
import { useApiQuery } from "@/hooks/use-api-query";
import { api } from "@/lib/api";
import { useChatStore } from "@/lib/chat/store";
import { humanize } from "@/lib/order-view";

export function PolicyDetail({ policyId }: { policyId: string }) {
  const router = useRouter();
  const startConversation = useChatStore((state) => state.startConversation);
  const query = useApiQuery(`policy:${policyId}`, () => api.getPolicy(policyId));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Link
        href="/policies"
        className="inline-flex items-center gap-1.5 text-[0.8125rem] text-fg-muted hover:text-fg"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All policies
      </Link>

      <div className="mt-4">
        <EndpointTag method="GET" path={`/policies/${policyId}`} />
      </div>

      {query.status === "loading" ? (
        <div className="mt-4 flex flex-col gap-3" aria-label="Loading policy">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="mt-4 h-40" />
        </div>
      ) : query.status === "error" ? (
        <div className="mt-6">
          {query.error.status === 404 ? (
            <EmptyState
              icon={<FileText aria-hidden />}
              title="Policy not found"
              action={
                <Link
                  href="/policies"
                  className="text-sm font-medium text-brand-ink hover:underline"
                >
                  Back to policies
                </Link>
              }
            />
          ) : (
            <ErrorState
              title="Couldn't load this policy"
              message={query.error.message}
              onRetry={query.retry}
            />
          )}
        </div>
      ) : (
        <article className="mt-4">
          <header className="border-b border-line pb-5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-fg-subtle">
              {query.data.category ? (
                <Badge size="sm">{humanize(query.data.category)}</Badge>
              ) : null}
              {query.data.version ? <span>{query.data.version}</span> : null}
              {query.data.effective_date ? (
                <span>Effective {query.data.effective_date}</span>
              ) : null}
            </div>
            <h1 className="mt-3 font-display-tight text-3xl font-medium leading-tight text-fg">
              {query.data.title}
            </h1>
            {query.data.summary ? (
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-fg-muted">
                {query.data.summary}
              </p>
            ) : null}
          </header>

          <div className="flex flex-col gap-6 py-6">
            {query.data.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="font-display-tight text-lg font-medium text-fg">
                  {section.heading}
                </h2>
                <p className="prose-answer mt-2 text-fg-muted">{section.content}</p>
              </section>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-1 p-4">
            <p className="min-w-0 flex-1 text-sm text-fg-muted">
              Have a question about this policy?
            </p>
            <Button
              variant="primary"
              onClick={() => {
                void startConversation(`Can you explain the ${query.data.title} policy?`);
                router.push("/");
              }}
            >
              <MessagesSquare aria-hidden />
              Ask support
            </Button>
          </div>
        </article>
      )}
    </div>
  );
}
