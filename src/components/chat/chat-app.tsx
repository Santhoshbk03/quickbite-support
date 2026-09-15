"use client";

import { History, MessageSquare, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Skeleton } from "@/components/ui/primitives";
import { Sidebar, SidebarItem } from "@/components/ui/sidebar";
import { useHasRail } from "@/hooks/use-media-query";
import { useChatStore } from "@/lib/chat/store";
import { Composer } from "./composer";
import { ChatEmptyState } from "./empty-state";
import { Thread } from "./thread";

export function ChatApp() {
  const hasRail = useHasRail();
  const [historyOpen, setHistoryOpen] = useState(false);
  const hydrated = useChatStore((state) => state.hydrated);
  const pendingId = useChatStore((state) => state.pendingId);
  const newConversation = useChatStore((state) => state.newConversation);
  const send = useChatStore((state) => state.send);
  const active = useChatStore(
    (state) => state.conversations.find((item) => item.id === state.activeId) ?? null,
  );

  return (
    <div className="flex h-full min-h-0">
      <Sidebar
        collapsed={false}
        hasRail={hasRail}
        drawerOpen={historyOpen}
        onDrawerOpenChange={setHistoryOpen}
        label="Conversation history"
      >
        <HistoryPanel onNavigate={() => setHistoryOpen(false)} />
      </Sidebar>

      <main className="flex min-w-0 flex-1 flex-col">
        {hasRail ? null : (
          <div className="flex shrink-0 items-center justify-between border-b border-line px-2 py-1.5">
            <Button size="sm" variant="ghost" onClick={() => setHistoryOpen(true)}>
              <History aria-hidden />
              History
            </Button>
            <Button size="sm" variant="ghost" onClick={newConversation} disabled={!active}>
              <Plus aria-hidden />
              New chat
            </Button>
          </div>
        )}

        <div className="min-h-0 flex-1">
          {active ? (
            <Thread key={active.id} conversation={active} pending={pendingId === active.id} />
          ) : (
            <ChatEmptyState
              onPick={(question) => void send(question)}
              disabled={!hydrated || pendingId !== null}
            />
          )}
        </div>

        <Composer
          onSend={(text) => void send(text)}
          disabled={!hydrated}
          busy={pendingId !== null}
        />
      </main>
    </div>
  );
}

function HistoryPanel({ onNavigate }: { onNavigate: () => void }) {
  const hydrated = useChatStore((state) => state.hydrated);
  const conversations = useChatStore((state) => state.conversations);
  const activeId = useChatStore((state) => state.activeId);
  const newConversation = useChatStore((state) => state.newConversation);
  const selectConversation = useChatStore((state) => state.selectConversation);
  const deleteConversation = useChatStore((state) => state.deleteConversation);

  const sorted = [...conversations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="p-3">
        <Button
          className="w-full"
          onClick={() => {
            newConversation();
            onNavigate();
          }}
        >
          <Plus aria-hidden />
          New chat
        </Button>
      </div>
      <p className="eyebrow px-4 pb-1.5 pt-1">Recent</p>
      <ul className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {!hydrated ? (
          [0, 1, 2].map((key) => (
            <li key={key} className="px-1 py-1">
              <Skeleton className="h-7" />
            </li>
          ))
        ) : sorted.length === 0 ? (
          <li className="px-2.5 py-2 text-xs leading-relaxed text-fg-subtle">
            No conversations yet. They are saved in this browser.
          </li>
        ) : (
          sorted.map((conversation) => (
            <li key={conversation.id} className="group relative">
              <SidebarItem
                icon={<MessageSquare aria-hidden />}
                label={conversation.title}
                active={conversation.id === activeId}
                className="pr-10"
                onClick={() => {
                  selectConversation(conversation.id);
                  onNavigate();
                }}
              />
              <IconButton
                label="Delete conversation"
                icon={<Trash2 aria-hidden />}
                tooltipSide="right"
                className="absolute right-1 top-1/2 size-7 -translate-y-1/2 opacity-0 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                onClick={() => deleteConversation(conversation.id)}
              />
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
