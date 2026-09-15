"use client";

import {
  Ban,
  BookOpenText,
  Code,
  LayoutTemplate,
  MessagesSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Plus,
  ReceiptText,
  Repeat2,
  Trash2,
  Truck,
} from "lucide-react";
import Link from "next/link";

import { LogoMark, Wordmark } from "@/components/brand/logo";
import { IconButton } from "@/components/ui/icon-button";
import { Skeleton } from "@/components/ui/primitives";
import { Sidebar, SidebarItem, useSidebar } from "@/components/ui/sidebar";
import { useHasRail } from "@/hooks/use-media-query";
import { useChatHydrated, useChatStore } from "@/lib/chat/store";
import type { Conversation } from "@/lib/chat/types";
import { SCRIPTED_CONVERSATIONS } from "@/lib/fixtures";
import type { Capability } from "@/lib/fixtures";
import { formatRelativeDay } from "@/lib/format";
import { SITE } from "@/lib/site";
import { useUiStore } from "@/lib/ui/store";
import { cn } from "@/lib/utils";

const CAPABILITY_ICON: Record<Capability, React.ReactNode> = {
  policy: <BookOpenText aria-hidden />,
  refund: <ReceiptText aria-hidden />,
  tool_use: <Truck aria-hidden />,
  multi_turn: <Repeat2 aria-hidden />,
  refusal: <Ban aria-hidden />,
};

export function HistoryRail() {
  const hasRail = useHasRail();
  const collapsed = useUiStore((state) => state.railCollapsed);
  const drawerOpen = useUiStore((state) => state.historyDrawerOpen);
  const setDrawerOpen = useUiStore((state) => state.setHistoryDrawerOpen);

  return (
    <Sidebar
      label="Conversation history"
      collapsed={hasRail && collapsed}
      hasRail={hasRail}
      drawerOpen={drawerOpen}
      onDrawerOpenChange={setDrawerOpen}
      className="hidden min-[900px]:flex"
    >
      <RailContents />
    </Sidebar>
  );
}

function RailContents() {
  const { collapsed, inDrawer } = useSidebar();
  const hydrated = useChatHydrated();
  const order = useChatStore((state) => state.order);
  const conversations = useChatStore((state) => state.conversations);
  const activeId = useChatStore((state) => state.activeId);
  const replayingId = useChatStore((state) => state.replayingId);
  const busy = useChatStore(
    (state) => state.streamingTurnId !== null || state.replayingId !== null,
  );
  const newConversation = useChatStore((state) => state.newConversation);
  const selectConversation = useChatStore((state) => state.selectConversation);
  const deleteConversation = useChatStore((state) => state.deleteConversation);
  const replay = useChatStore((state) => state.replay);
  const setRailCollapsed = useUiStore((state) => state.setRailCollapsed);
  const setDrawerOpen = useUiStore((state) => state.setHistoryDrawerOpen);

  const closeDrawer = () => {
    if (inDrawer) setDrawerOpen(false);
  };

  const groups = groupByDay(
    order.map((id) => conversations[id]).filter((c): c is Conversation => !!c),
  );

  return (
    <>
      <div
        className={cn(
          "flex h-14 shrink-0 items-center gap-2 border-b border-line px-3",
          collapsed && "justify-center px-0",
        )}
      >
        {collapsed ? <LogoMark title="QuickBite Support" /> : <Wordmark />}
        {inDrawer || collapsed ? null : (
          <IconButton
            label="Collapse sidebar"
            icon={<PanelLeftClose aria-hidden />}
            className="ml-auto"
            tooltipSide="right"
            onClick={() => setRailCollapsed(true)}
          />
        )}
      </div>

      <div className={cn("flex flex-col gap-1 p-2", collapsed && "items-center")}>
        {collapsed ? (
          <IconButton
            label="Expand sidebar"
            icon={<PanelLeftOpen aria-hidden />}
            tooltipSide="right"
            onClick={() => setRailCollapsed(false)}
          />
        ) : null}
        <SidebarItem
          icon={<Plus aria-hidden />}
          label="New conversation"
          className={cn(
            "border border-line-strong bg-surface-2 text-fg shadow-1 hover:bg-surface-3",
            collapsed && "w-9 justify-center px-0",
          )}
          onClick={() => {
            newConversation();
            closeDrawer();
          }}
        />
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 pb-3">
        {collapsed ? null : (
          <>
            <RailSection title="Conversations">
              {!hydrated ? (
                <div className="flex flex-col gap-2 px-2.5 py-1" aria-hidden>
                  {[70, 88, 56].map((width) => (
                    <Skeleton key={width} className="h-4" style={{ width: `${width}%` }} />
                  ))}
                </div>
              ) : groups.length === 0 ? (
                <p className="px-2.5 py-1 text-[0.8125rem] leading-relaxed text-fg-subtle">
                  Your conversations stay in this browser and appear here.
                </p>
              ) : (
                groups.map((group) => (
                  <div key={group.label} className="mt-1 first:mt-0">
                    <p className="px-2.5 pb-1 pt-2 text-2xs font-medium text-fg-subtle">
                      {group.label}
                    </p>
                    <ul className="flex flex-col gap-px">
                      {group.items.map((conversation) => (
                        <li key={conversation.id} className="group/row relative">
                          <SidebarItem
                            icon={
                              conversation.replayOf ? (
                                <Play aria-hidden />
                              ) : (
                                <MessagesSquare aria-hidden />
                              )
                            }
                            label={conversation.title}
                            active={conversation.id === activeId}
                            className="pr-9"
                            onClick={() => {
                              selectConversation(conversation.id);
                              closeDrawer();
                            }}
                          />
                          {conversation.id === replayingId ? (
                            <span
                              className="pointer-events-none absolute right-2.5 top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-brand motion-safe:animate-pulse"
                              aria-label="Replaying"
                            />
                          ) : (
                            <IconButton
                              label={`Delete “${conversation.title}”`}
                              icon={<Trash2 aria-hidden />}
                              tooltipSide="right"
                              className="absolute right-1 top-1/2 size-7 -translate-y-1/2 opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                              onClick={() => deleteConversation(conversation.id)}
                            />
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </RailSection>

            <RailSection
              title="Recorded sessions"
              hint="Plays a scripted conversation through the live UI"
            >
              <ul className="flex flex-col gap-px">
                {SCRIPTED_CONVERSATIONS.map((script) => (
                  <li key={script.id}>
                    <SidebarItem
                      icon={CAPABILITY_ICON[script.capability]}
                      label={script.title}
                      title={script.summary}
                      disabled={busy || !hydrated}
                      className="disabled:opacity-50"
                      onClick={() => {
                        closeDrawer();
                        void replay(script.id);
                      }}
                    />
                  </li>
                ))}
              </ul>
            </RailSection>
          </>
        )}
      </div>

      {collapsed ? null : (
        <div className="flex shrink-0 items-center gap-1 border-t border-line px-3 py-2.5 text-2xs text-fg-subtle">
          <Link
            href="/styleguide"
            className="inline-flex items-center gap-1.5 rounded-xs px-1.5 py-1 hover:text-fg focus-visible:ring-2 focus-visible:ring-ring"
          >
            <LayoutTemplate className="size-3.5" aria-hidden />
            Styleguide
          </Link>
          <a
            href={SITE.repoUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xs px-1.5 py-1 hover:text-fg focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Code className="size-3.5" aria-hidden />
            Source
          </a>
        </div>
      )}
    </>
  );
}

function RailSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-3 first:mt-1">
      <h2 className="eyebrow px-2.5 pb-1.5" title={hint}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function groupByDay(conversations: Conversation[]): { label: string; items: Conversation[] }[] {
  const groups = new Map<string, Conversation[]>();
  for (const conversation of conversations) {
    const label = formatRelativeDay(conversation.updatedAt);
    groups.set(label, [...(groups.get(label) ?? []), conversation]);
  }
  return [...groups.entries()].map(([label, items]) => ({ label, items }));
}
