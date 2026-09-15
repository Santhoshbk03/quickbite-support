"use client";

import { BookOpenText, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { EmptyState, EndpointTag, ErrorState } from "@/components/site/page-states";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/primitives";
import { useApiQuery } from "@/hooks/use-api-query";
import { api } from "@/lib/api";
import { humanize } from "@/lib/order-view";
import { cn } from "@/lib/utils";

export function PoliciesList() {
  const query = useApiQuery("policies", () => api.listPolicies());
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const policies = query.status === "success" ? query.data : [];
  const categories = [
    ...new Set(policies.map((policy) => policy.category).filter(Boolean)),
  ] as string[];
  const term = search.trim().toLowerCase();
  const visible = policies.filter(
    (policy) =>
      (!category || policy.category === category) &&
      (!term ||
        policy.title.toLowerCase().includes(term) ||
        (policy.summary ?? "").toLowerCase().includes(term)),
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-6">
        <EndpointTag method="GET" path="/policies" />
        <h1 className="mt-3 font-display-tight text-3xl font-medium text-fg">Support policies</h1>
        <p className="mt-1.5 text-sm text-fg-muted">The documents the assistant answers from.</p>
      </header>

      {query.status === "loading" ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading policies">
          {[0, 1, 2, 3, 4, 5].map((key) => (
            <li key={key}>
              <Skeleton className="h-36 rounded-lg" />
            </li>
          ))}
        </ul>
      ) : query.status === "error" ? (
        <ErrorState
          title="Couldn't load policies"
          message={query.error.message}
          onRetry={query.retry}
        />
      ) : (
        <>
          <div className="mb-5 flex flex-col gap-3">
            <label className="relative block max-w-md">
              <span className="sr-only">Search policies</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle"
                aria-hidden
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search refunds, delivery, allergens…"
                className="h-10 w-full rounded-md border border-line-strong bg-surface-2 pl-9 pr-3 text-sm text-fg outline-none placeholder:text-fg-subtle focus:border-brand-line"
              />
            </label>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
              {[null, ...categories].map((value) => (
                <button
                  key={value ?? "all"}
                  type="button"
                  aria-pressed={category === value}
                  onClick={() => setCategory(value)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    category === value
                      ? "border-brand-line bg-brand-soft text-brand-ink"
                      : "border-line bg-surface-1 text-fg-muted hover:text-fg",
                  )}
                >
                  {value ? humanize(value) : "All"}
                </button>
              ))}
            </div>
          </div>

          {visible.length === 0 ? (
            <EmptyState
              icon={<BookOpenText aria-hidden />}
              title="No matching policies"
              description="Try a different word or category."
            />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((policy) => (
                <li key={policy.id}>
                  <Link
                    href={`/policies/${encodeURIComponent(policy.id)}`}
                    className="flex h-full flex-col gap-2 rounded-lg border border-line bg-surface-1 p-4 shadow-1 transition-colors hover:border-brand-line hover:bg-surface-2"
                  >
                    {policy.category ? (
                      <Badge size="sm" className="self-start">
                        {humanize(policy.category)}
                      </Badge>
                    ) : null}
                    <span className="font-medium leading-snug text-fg">{policy.title}</span>
                    {policy.summary ? (
                      <span className="line-clamp-3 text-[0.8125rem] leading-relaxed text-fg-subtle">
                        {policy.summary}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
