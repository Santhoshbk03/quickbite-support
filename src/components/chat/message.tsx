"use client";

import {
  Check,
  CircleAlert,
  Copy,
  FileText,
  RotateCcw,
  SearchX,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { LogoMark } from "@/components/brand/logo";
import { OrderCard } from "@/components/orders/order-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { useCopy } from "@/hooks/use-copy";
import { useChatStore } from "@/lib/chat/store";
import type { AssistantMessage, UserMessage } from "@/lib/chat/store";
import { cn } from "@/lib/utils";

export function UserBubble({ message }: { message: UserMessage }) {
  return (
    <div className="flex scroll-mt-4 justify-end">
      <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-lg rounded-br-xs bg-surface-3 px-4 py-2.5 text-[0.9375rem] leading-relaxed text-fg">
        {message.content}
      </p>
    </div>
  );
}

export function AssistantReply({
  message,
  showSuggestions,
}: {
  message: AssistantMessage;
  showSuggestions: boolean;
}) {
  const busy = useChatStore((state) => state.pendingId !== null);
  const retry = useChatStore((state) => state.retry);
  const rate = useChatStore((state) => state.rate);
  const send = useChatStore((state) => state.send);
  const { copied, copy } = useCopy();

  return (
    <article aria-label="Support reply" className="flex scroll-mt-4 gap-3">
      <LogoMark className="mt-0.5 size-7" />
      <div className="min-w-0 flex-1">
        {message.status === "error" ? (
          <div
            role="alert"
            className="flex flex-col items-start gap-3 rounded-lg border border-[color-mix(in_oklab,var(--danger)_28%,transparent)] bg-danger-soft p-4"
          >
            <div className="flex items-start gap-2.5">
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
              <div>
                <p className="text-sm font-medium text-fg">Couldn&apos;t get an answer</p>
                <p className="mt-0.5 text-[0.8125rem] text-fg-muted">{message.error}</p>
              </div>
            </div>
            <Button size="sm" disabled={busy} onClick={() => void retry(message.id)}>
              <RotateCcw aria-hidden />
              Try again
            </Button>
          </div>
        ) : (
          <>
            {message.refused ? (
              <Badge tone="outline" size="sm" className="mb-2">
                <SearchX aria-hidden />
                No policy covers this
              </Badge>
            ) : null}

            <Markdown content={message.content} />

            {message.order ? (
              <div className="mt-4">
                <OrderCard order={message.order} referenceTime={message.createdAt} compact />
              </div>
            ) : null}

            {message.sources.length > 0 ? (
              <div className="mt-4">
                <p className="eyebrow mb-2">Sources</p>
                <ul className="flex flex-wrap gap-1.5">
                  {message.sources.map((source) => (
                    <li key={source.id} className="max-w-full">
                      <Link
                        href={`/policies/${encodeURIComponent(source.id)}`}
                        title={source.snippet ?? undefined}
                        className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-surface-1 px-2.5 py-1 text-xs text-fg-muted transition-colors hover:border-brand-line hover:text-fg"
                      >
                        <FileText className="size-3.5 shrink-0 text-brand-ink" aria-hidden />
                        <span className="truncate">{source.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-3 flex items-center gap-0.5 text-fg-subtle">
              <IconButton
                label={copied ? "Copied" : "Copy answer"}
                icon={copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                onClick={() => void copy(message.content)}
              />
              <IconButton
                label="Helpful"
                icon={<ThumbsUp aria-hidden />}
                aria-pressed={message.feedback === "up"}
                className={cn(message.feedback === "up" && "bg-brand-soft text-brand-ink")}
                onClick={() => rate(message.id, "up")}
              />
              <IconButton
                label="Not helpful"
                icon={<ThumbsDown aria-hidden />}
                aria-pressed={message.feedback === "down"}
                className={cn(message.feedback === "down" && "bg-brand-soft text-brand-ink")}
                onClick={() => rate(message.id, "down")}
              />
            </div>

            {showSuggestions && message.suggestions.length > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Suggested questions">
                {message.suggestions.map((suggestion) => (
                  <li key={suggestion}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void send(suggestion)}
                      className="rounded-full border border-brand-line bg-brand-soft px-3 py-1 text-left text-xs font-medium text-brand-ink transition-colors hover:bg-[color-mix(in_oklab,var(--brand)_19%,transparent)] disabled:opacity-50"
                    >
                      {suggestion}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </div>
    </article>
  );
}

function Markdown({ content }: { content: string }) {
  return (
    <div className="prose-answer">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) =>
            href?.startsWith("/") ? (
              <Link href={href}>{children}</Link>
            ) : (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
