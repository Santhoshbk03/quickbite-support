"use client";

import { useEffect, useRef } from "react";

import { LogoMark } from "@/components/brand/logo";
import { ThinkingDots } from "@/components/ui/primitives";
import type { Conversation } from "@/lib/chat/store";
import { AssistantReply, UserBubble } from "./message";

export function Thread({
  conversation,
  pending,
}: {
  conversation: Conversation;
  pending: boolean;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const hasScrolled = useRef(false);
  const { messages } = conversation;
  const last = messages.at(-1);
  const lastRole = last?.role;

  useEffect(() => {
    const target = listRef.current?.lastElementChild;
    if (!target) return;
    const initial = !hasScrolled.current;
    hasScrolled.current = true;
    // A new reply scrolls to its top so it can be read from the start; everything else to the end.
    target.scrollIntoView({
      block: !initial && !pending && lastRole === "assistant" ? "start" : "end",
      behavior: initial ? "auto" : "smooth",
    });
  }, [messages.length, pending, lastRole]);

  const lastAssistant = messages.findLast((message) => message.role === "assistant");

  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div
        ref={listRef}
        role="log"
        aria-label="Conversation"
        className="mx-auto flex max-w-3xl flex-col gap-7 px-4 py-6 sm:px-6 sm:py-8"
      >
        {messages.map((message) =>
          message.role === "user" ? (
            <UserBubble key={message.id} message={message} />
          ) : (
            <AssistantReply
              key={message.id}
              message={message}
              showSuggestions={!pending && message.id === lastAssistant?.id && message === last}
            />
          ),
        )}
        {pending ? (
          <div role="status" className="flex scroll-mt-4 items-center gap-3">
            <LogoMark className="size-7" />
            <span className="inline-flex items-center gap-2.5 text-[0.8125rem] text-fg-subtle">
              <ThinkingDots />
              Looking into it…
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
