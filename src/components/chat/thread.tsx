"use client";

import { ArrowDown, Play } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";

import { Skeleton } from "@/components/ui/primitives";
import { useActiveConversation, useChatHydrated, useChatStore } from "@/lib/chat/store";
import type { AssistantTurn, Conversation, UserTurn } from "@/lib/chat/types";
import { isAssistantTurn } from "@/lib/chat/types";
import { AssistantMessage, friendlyError, phaseCopy } from "./assistant-message";
import { Composer } from "./composer";
import { EmptyState } from "./empty-state";

export function ChatView() {
  const hydrated = useChatHydrated();
  const conversation = useActiveConversation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasTurns = !!conversation && conversation.turns.length > 0;

  return (
    <>
      <div
        ref={scrollRef}
        className="scrollbar-thin relative min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        {!hydrated ? (
          <ThreadSkeleton />
        ) : hasTurns ? (
          <Thread conversation={conversation} scrollRef={scrollRef} />
        ) : (
          <EmptyState />
        )}
      </div>
      <Composer />
    </>
  );
}

function Thread({
  conversation,
  scrollRef,
}: {
  conversation: Conversation;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const turnCount = conversation.turns.length;

  // Follow the stream while the reader is at the bottom; stop following the moment they scroll up.
  useEffect(() => {
    const scroller = scrollRef.current;
    const content = contentRef.current;
    if (!scroller || !content) return;

    const onScroll = () => {
      const distance = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
      stickToBottom.current = distance < 96;
      setShowJump(distance > 320);
    };
    const observer = new ResizeObserver(() => {
      if (stickToBottom.current) scroller.scrollTop = scroller.scrollHeight;
    });

    scroller.addEventListener("scroll", onScroll, { passive: true });
    observer.observe(content);
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [scrollRef]);

  // A new conversation or a new question always brings the latest turn into view.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    stickToBottom.current = true;
    scroller.scrollTop = scroller.scrollHeight;
  }, [conversation.id, turnCount, scrollRef]);

  return (
    <>
      <section aria-label="Conversation" className="relative">
        <div
          ref={contentRef}
          className="mx-auto flex max-w-3xl flex-col gap-8 px-4 pb-8 pt-6 sm:px-6 sm:pt-10"
        >
          {conversation.replayOf ? (
            <p className="flex items-center gap-2 self-center rounded-full border border-line bg-surface-1 px-3 py-1 text-2xs text-fg-subtle">
              <Play className="size-3 fill-current text-brand-ink" aria-hidden />
              Recorded session — streamed through the same pipeline as a live question
            </p>
          ) : null}
          {conversation.turns.map((turn, index) =>
            isAssistantTurn(turn) ? (
              <AssistantMessage key={turn.id} turn={turn} isLast={index === turnCount - 1} />
            ) : (
              <UserMessage key={turn.id} turn={turn} />
            ),
          )}
        </div>
        {showJump ? (
          <div className="pointer-events-none sticky bottom-3 flex justify-center">
            <button
              type="button"
              onClick={() => {
                const scroller = scrollRef.current;
                if (scroller) scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
              }}
              className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface-3 px-3 py-1.5 text-xs font-medium text-fg shadow-2 transition-colors hover:bg-surface-2"
            >
              <ArrowDown className="size-3.5" aria-hidden />
              Latest
            </button>
          </div>
        ) : null}
      </section>
      <LiveAnnouncer conversation={conversation} />
    </>
  );
}

const UserMessage = memo(function UserMessage({ turn }: { turn: UserTurn }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[88%] whitespace-pre-wrap break-words rounded-xl rounded-br-xs border border-line bg-surface-3 px-4 py-2.5 text-[0.9375rem] leading-relaxed text-fg shadow-1 sm:max-w-[80%]">
        <span className="sr-only">You asked: </span>
        {turn.content}
      </div>
    </div>
  );
});

/**
 * Screen readers hear phase changes and the finished answer, never individual tokens: announcing a
 * stream token by token is unusable.
 */
function LiveAnnouncer({ conversation }: { conversation: Conversation }) {
  const last = [...conversation.turns].reverse().find(isAssistantTurn);
  const streaming = useChatStore((state) => state.streamingTurnId !== null);
  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {last ? announcement(last, streaming) : ""}
    </div>
  );
}

function announcement(turn: AssistantTurn, streaming: boolean): string {
  switch (turn.status) {
    case "pending":
      return `${phaseCopy(turn)}…`;
    case "streaming":
      return turn.content ? "QuickBite is answering…" : `${phaseCopy(turn)}…`;
    case "complete":
      if (turn.refusal)
        return `QuickBite couldn’t find a policy covering that. ${turn.refusal.message}`;
      return `Answer ready. ${turn.content
        .replace(/\[\d{1,2}\]/g, "")
        .replace(/[*#|`_>-]/g, "")
        .slice(0, 320)}`;
    case "error":
      return turn.error ? `The answer failed. ${friendlyError(turn.error)}` : "The answer failed.";
    case "stopped":
      return streaming ? "" : "Answer stopped.";
  }
}

function ThreadSkeleton() {
  return (
    <div aria-hidden className="mx-auto flex max-w-3xl flex-col gap-8 px-4 pt-10 sm:px-6">
      <Skeleton className="ml-auto h-11 w-2/3 rounded-xl" />
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-3/5" />
      </div>
    </div>
  );
}
