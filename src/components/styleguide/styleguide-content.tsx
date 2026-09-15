"use client";

import { ArrowLeft, BookOpenText, Plus, ReceiptText, ScanSearch, Truck } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

import { Wordmark } from "@/components/brand/logo";
import { CitationChip } from "@/components/chat/citation-chip";
import { RefusalCard } from "@/components/chat/refusal-card";
import { OrderCard } from "@/components/chat/tool-call-card";
import { ArchitectureDiagram } from "@/components/how-it-works/architecture";
import { DistanceScale } from "@/components/inspector/distance-scale";
import { Badge, StatusDot } from "@/components/ui/badge";
import { BentoGrid, BentoGridItem } from "@/components/ui/bento-grid";
import { Button } from "@/components/ui/button";
import { HoverEffect } from "@/components/ui/card-hover-effect";
import { InfiniteMovingCards } from "@/components/ui/infinite-moving-cards";
import { MovingBorder } from "@/components/ui/moving-border";
import { Kbd, Skeleton, Surface, ThinkingDots } from "@/components/ui/primitives";
import { SidebarItem } from "@/components/ui/sidebar";
import { Spotlight } from "@/components/ui/spotlight";
import { Timeline } from "@/components/ui/timeline";
import { TracingBeam } from "@/components/ui/tracing-beam";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { createRandom, planResponse, TIMING_PROFILES } from "@/lib/api/mock";
import { applyCitationUsage } from "@/lib/api/mock";
import { createAssistantTurn } from "@/lib/chat/reducer";
import type { AssistantTurn } from "@/lib/chat/types";
import {
  buildLookupOrderResult,
  getChunk,
  KNOWLEDGE_DOCUMENTS,
  ORDERS_BY_ID,
} from "@/lib/fixtures";
import { cn } from "@/lib/utils";

/* Fixed inputs keep this page deterministic: no Date.now() or randomness during render. */
const FIXED_NOW = new Date("2026-09-14T14:12:07.512Z");
const SAMPLE_ORDER = ORDERS_BY_ID.get("QB-2026-481213");
const SAMPLE_CHUNK = getChunk("chk_late-delivery-compensation_01");

function buildRefusalTurn(): AssistantTurn {
  const plan = planResponse(
    {
      conversation_id: "conv_styleguide",
      message: {
        id: "msg_styleguide",
        content: "How much do QuickBite delivery partners earn per order?",
      },
      history: [],
      options: null,
    },
    { now: FIXED_NOW, rng: createRandom(7), profile: TIMING_PROFILES.instant },
  );
  return {
    ...createAssistantTurn({
      id: "turn_styleguide",
      replyTo: "msg_styleguide",
      source: "mock",
      createdAt: FIXED_NOW.toISOString(),
    }),
    status: "complete",
    content: plan.content,
    retrieval: applyCitationUsage(plan.retrieval, plan.content),
    refusal: plan.refusal,
    finishReason: plan.finishReason,
    completedAt: FIXED_NOW.toISOString(),
  };
}

const REFUSAL_TURN = buildRefusalTurn();

const TOKEN_GROUPS: { title: string; tokens: { name: string; note?: string }[] }[] = [
  {
    title: "Surfaces",
    tokens: [
      { name: "canvas" },
      { name: "surface-sunken" },
      { name: "surface-1" },
      { name: "surface-2" },
      { name: "surface-3" },
    ],
  },
  {
    title: "Text & lines",
    tokens: [
      { name: "fg" },
      { name: "fg-muted" },
      { name: "fg-subtle" },
      { name: "line" },
      { name: "line-strong" },
    ],
  },
  {
    title: "Brand · saffron",
    tokens: [
      { name: "brand" },
      { name: "brand-hover" },
      { name: "brand-ink" },
      { name: "brand-soft" },
      { name: "brand-line" },
    ],
  },
  {
    title: "Semantic",
    tokens: [
      { name: "success" },
      { name: "danger" },
      { name: "info" },
      { name: "success-soft" },
      { name: "danger-soft" },
    ],
  },
];

export function StyleguideContent() {
  return (
    <TooltipProvider>
      <div className="min-h-dvh bg-canvas">
        <header className="sticky top-0 z-30 border-b border-line bg-canvas">
          <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-8">
            <Wordmark />
            <Badge size="sm">Design system</Badge>
            <Link
              href="/"
              className="ml-auto inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-[0.8125rem] text-fg-muted hover:text-fg focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Back to the app
            </Link>
          </div>
        </header>

        <main className="mx-auto flex max-w-7xl flex-col gap-16 px-4 pb-24 pt-12 sm:px-8">
          <section className="max-w-3xl">
            <p className="eyebrow">Styleguide</p>
            <h1 className="mt-2 font-display-tight text-[2.75rem] font-medium leading-[1.05] text-fg">
              Warm, restrained, and legible at 2am.
            </h1>
            <p className="mt-4 text-[1.0625rem] leading-relaxed text-fg-muted">
              One saffron accent on warm charcoal. Depth comes from layered surfaces, hairlines, and
              light that falls from above — not from blur. Every colour, radius, and shadow below is
              a token; every component is shown in both themes.
            </p>
          </section>

          <GuideSection
            title="Colour tokens"
            note="OKLCH, with real hue in every neutral. Dark is primary; light is specified, not inverted."
          >
            <Themed>
              <div className="flex flex-col gap-5">
                {TOKEN_GROUPS.map((group) => (
                  <div key={group.title}>
                    <p className="mb-2 text-xs font-medium text-fg-muted">{group.title}</p>
                    <div className="grid grid-cols-5 gap-2">
                      {group.tokens.map((token) => (
                        <div key={token.name} className="min-w-0">
                          <div
                            className="h-11 rounded-sm border border-line shadow-1"
                            style={{ background: `var(--${token.name})` }}
                          />
                          <p className="mt-1 truncate font-mono text-2xs text-fg-subtle">
                            {token.name}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Themed>
          </GuideSection>

          <GuideSection
            title="Typography"
            note="Fraunces for display (optical sizing, soft axis), Instrument Sans for reading, JetBrains Mono for anything you would compare."
          >
            <Themed>
              <div className="flex flex-col gap-4">
                <p className="font-display-tight text-[2.75rem] font-medium leading-none text-fg">
                  Answers from policy.
                </p>
                <p className="font-display-tight text-[1.75rem] font-medium leading-tight text-fg">
                  Late delivery compensation
                </p>
                <p className="font-display-tight text-lg font-medium text-fg">
                  Every answer, taken apart
                </p>
                <p className="prose-answer max-w-prose">
                  Missing items are refunded at <strong>full item value</strong> when reported
                  within 2 hours of delivery, and no photo is needed.
                </p>
                <p className="text-[0.8125rem] text-fg-muted">Secondary · 13px · muted</p>
                <p className="eyebrow">Eyebrow · 11px · tracked</p>
                <p className="font-mono text-xs tabular text-fg-muted">
                  distance 0.238 · 2.39 s · ₹591
                </p>
              </div>
            </Themed>
          </GuideSection>

          <GuideSection
            title="Radius & elevation"
            note="Radii from 6 to 28px; three shadow steps with a top highlight."
          >
            <Themed>
              <div className="flex flex-wrap items-end gap-4">
                {[
                  "rounded-xs",
                  "rounded-sm",
                  "rounded-md",
                  "rounded-lg",
                  "rounded-xl",
                  "rounded-2xl",
                ].map((radius) => (
                  <div key={radius} className="text-center">
                    <div className={cn("size-14 border border-line-strong bg-surface-2", radius)} />
                    <p className="mt-1 font-mono text-2xs text-fg-subtle">
                      {radius.replace("rounded-", "")}
                    </p>
                  </div>
                ))}
                {["shadow-1", "shadow-2", "shadow-3"].map((shadow) => (
                  <div key={shadow} className="text-center">
                    <div
                      className={cn("size-14 rounded-md border border-line bg-surface-2", shadow)}
                    />
                    <p className="mt-1 font-mono text-2xs text-fg-subtle">{shadow}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-fg-subtle">
                Motion: 150–250ms, <span className="font-mono">cubic-bezier(0.22, 1, 0.36, 1)</span>{" "}
                by default; springs only for the tooltip tilt. Everything respects reduced motion.
              </p>
            </Themed>
          </GuideSection>

          <GuideSection title="Primitives">
            <Themed>
              <div className="flex flex-col gap-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="primary">Primary</Button>
                  <Button>Secondary</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="subtle">Subtle</Button>
                  <Button variant="danger">Danger</Button>
                  <Button loading>Loading</Button>
                  <Button disabled>Disabled</Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>Neutral</Badge>
                  <Badge tone="brand">Brand</Badge>
                  <Badge tone="success">On time</Badge>
                  <Badge tone="danger">28 min late</Badge>
                  <Badge tone="info">Confirmed</Badge>
                  <Badge tone="outline" mono>
                    QB-2026-481213
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-[0.8125rem] text-fg-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <Kbd>⌘</Kbd>
                    <Kbd>.</Kbd> inspector
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <ThinkingDots /> Searching policy documents
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <StatusDot tone="success" pulse /> Live
                  </span>
                  <Tooltip content="A plain label tooltip">
                    <Button size="sm">Hover me</Button>
                  </Tooltip>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Surface level={1} className="p-3 text-xs text-fg-muted">
                    Surface 1
                  </Surface>
                  <Surface level={2} className="p-3 text-xs text-fg-muted">
                    Surface 2
                  </Surface>
                  <Surface level={3} className="p-3 text-xs text-fg-muted">
                    Surface 3
                  </Surface>
                </div>
                <div className="flex flex-col gap-2" aria-hidden>
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            </Themed>
          </GuideSection>

          <section aria-labelledby="aceternity-title" className="flex flex-col gap-10">
            <div className="max-w-3xl">
              <h2 id="aceternity-title" className="font-display-tight text-2xl font-medium text-fg">
                Aceternity components, rethemed
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">
                Installed with <code className="font-mono text-xs">shadcn add @aceternity/…</code>,
                then rewritten against the tokens: no neutral-950, slate, or blue–purple gradients,
                no tabler icons, no <code className="font-mono text-xs">any</code>, and every one
                respects reduced motion. Each shows what it is used for in the product.
              </p>
            </div>

            <Specimen
              name="Moving Border"
              usage="Only the demo-mode status badge in the header."
              changes="Saffron orbit instead of sky blue; static hairline underneath; no backdrop blur; not rendered under reduced motion."
            >
              <MovingBorder radius={14}>
                <span className="inline-flex h-[26px] items-center gap-2 px-2.5 text-xs font-medium text-fg-muted">
                  <StatusDot tone="brand" /> Demo mode
                </span>
              </MovingBorder>
            </Specimen>

            <Specimen
              name="Animated Tooltip"
              usage="Citation chip previews inside answers."
              changes="Re-platformed on Base UI for portal positioning and focus support; tilt reduced from ±45° to ±5°; token surfaces."
            >
              <p className="prose-answer">
                Credits are applied automatically within 2 hours of delivery
                <CitationChip
                  chunk={{
                    id: SAMPLE_CHUNK.id,
                    rank: 1,
                    distance: 0.238,
                    passed_threshold: true,
                    used_in_answer: true,
                    text: SAMPLE_CHUNK.text,
                    document: SAMPLE_CHUNK.document,
                  }}
                  turnId="turn_styleguide"
                />
                .
              </p>
            </Specimen>

            <Specimen
              name="Card Hover Effect"
              usage="Example questions in the empty state."
              changes="Buttons instead of links; highlight follows keyboard focus; saffron-tinted highlight; fades in place under reduced motion."
            >
              <HoverEffect
                className="-mx-1.5 !grid-cols-1"
                onSelect={() => undefined}
                items={[
                  {
                    id: "a",
                    title: "What happens if my delivery is late?",
                    description: "Retrieval over policy documents",
                    eyebrow: (
                      <Badge size="sm">
                        <BookOpenText aria-hidden />
                        Policy
                      </Badge>
                    ),
                  },
                  {
                    id: "b",
                    title: "Where's my order QB-2026-481213?",
                    description: "lookup_order tool call",
                    eyebrow: (
                      <Badge size="sm">
                        <Truck aria-hidden />
                        Tool call
                      </Badge>
                    ),
                  },
                ]}
              />
            </Specimen>

            <Specimen
              name="Sidebar"
              usage="Conversation history rail (collapsible), and the mobile drawer."
              changes="Explicit collapse toggle instead of hover-expand; focus-trapped drawer on mobile; lucide icons; token surfaces."
            >
              <div className="w-64 rounded-md border border-line bg-surface-1 p-2">
                <SidebarItem
                  icon={<Plus aria-hidden />}
                  label="New conversation"
                  className="border border-line-strong bg-surface-2 text-fg shadow-1"
                />
                <div className="mt-2 flex flex-col gap-px">
                  <SidebarItem
                    icon={<ReceiptText aria-hidden />}
                    label="Missing item and cold food refund"
                    active
                  />
                  <SidebarItem
                    icon={<ScanSearch aria-hidden />}
                    label="Late delivery compensation"
                  />
                </div>
              </div>
            </Specimen>

            <Specimen
              name="Timeline"
              usage="Order status inside the lookup_order card."
              changes="Condensed from a scroll-driven page changelog to a compact status rail; the beam fills to the current step once, from order state."
            >
              <Timeline
                steps={[
                  { id: "1", title: "Order placed", meta: "6:50 PM", state: "complete" },
                  {
                    id: "2",
                    title: "Being prepared",
                    meta: "6:54 PM",
                    detail: "Kitchen ran behind on a large order",
                    state: "complete",
                  },
                  { id: "3", title: "Picked up by Ravi", meta: "7:33 PM", state: "current" },
                  { id: "4", title: "Delivered", state: "upcoming" },
                ]}
              />
            </Specimen>

            <Specimen
              name="Tracing Beam"
              usage="The “How this works” architecture walkthrough."
              changes="Works inside a scrolling drawer, measures height with ResizeObserver, saffron gradient, hidden under reduced motion."
            >
              <TracingBeamSample />
            </Specimen>

            <Specimen
              name="Bento Grid"
              usage="Capabilities on the landing section."
              changes="Token surfaces and hairlines; display face for titles; hover nudge on pointer devices only."
            >
              <BentoGrid className="md:!grid-cols-2">
                <BentoGridItem
                  icon={<ScanSearch aria-hidden />}
                  title="Grounded retrieval"
                  description="Citations with distances, one click away."
                />
                <BentoGridItem
                  icon={<Truck aria-hidden />}
                  title="Real tool calls"
                  description="lookup_order renders as a live order card."
                />
              </BentoGrid>
            </Specimen>

            <Specimen
              name="Infinite Moving Cards"
              usage="The knowledge-base marquee of policy titles."
              changes="No DOM cloning (duplicate is aria-hidden); CSS-only; pauses on hover and focus; static under reduced motion; quiet pills."
            >
              <InfiniteMovingCards
                label="Policy documents"
                speed="normal"
                items={KNOWLEDGE_DOCUMENTS.slice(0, 10).map((document) => ({
                  id: document.id,
                  label: document.title,
                }))}
              />
            </Specimen>

            <Specimen
              name="Spotlight"
              usage="The landing hero, once, heavily muted."
              changes="Brand-tinted at a fraction of the opacity; the 151px SVG blur is replaced by a radial gradient; plays once."
            >
              <div className="relative h-44 overflow-hidden rounded-md border border-line bg-canvas">
                <Spotlight className="-top-24 left-0" />
                <p className="relative p-5 font-display-tight text-xl text-fg">
                  Answers from policy.
                </p>
              </div>
            </Specimen>
          </section>

          <GuideSection
            title="Domain components"
            note="Built from the primitives above and fed by the API contract's types."
          >
            <div className="flex flex-col gap-4">
              <Themed>
                <DistanceScale
                  threshold={0.55}
                  metric="cosine"
                  marks={[
                    {
                      id: "a",
                      distance: 0.238,
                      label: "Late Delivery Compensation",
                      state: "cited",
                    },
                    { id: "b", distance: 0.327, label: "Exemptions", state: "cited" },
                    { id: "c", distance: 0.492, label: "Severe weather", state: "passed" },
                    { id: "d", distance: 0.612, label: "Rider conduct", state: "rejected" },
                  ]}
                />
              </Themed>
              {SAMPLE_ORDER ? (
                <Themed>
                  <OrderCard
                    order={buildLookupOrderResult(SAMPLE_ORDER, FIXED_NOW)}
                    referenceTime={FIXED_NOW.toISOString()}
                  />
                </Themed>
              ) : null}
              <Themed>
                <RefusalCard turn={REFUSAL_TURN} />
              </Themed>
              <Themed single>
                <ArchitectureDiagram />
              </Themed>
            </div>
          </GuideSection>
        </main>
      </div>
    </TooltipProvider>
  );
}

function GuideSection({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-4">
      <div className="max-w-3xl">
        <h2 className="font-display-tight text-2xl font-medium text-fg">{title}</h2>
        {note ? <p className="mt-1.5 text-sm text-fg-muted">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** Renders the same children once in each theme, side by side. */
function Themed({ children, single = false }: { children: React.ReactNode; single?: boolean }) {
  const panels = single ? (["dark"] as const) : (["dark", "light"] as const);
  return (
    <div className={cn("grid gap-3", !single && "lg:grid-cols-2")}>
      {panels.map((theme) => (
        <div
          key={theme}
          className={cn(theme, "min-w-0 rounded-xl border border-line bg-canvas p-5 text-fg")}
        >
          <p className="mb-4 font-mono text-2xs uppercase tracking-[0.08em] text-fg-subtle">
            {theme}
          </p>
          {children}
        </div>
      ))}
    </div>
  );
}

function Specimen({
  name,
  usage,
  changes,
  children,
}: {
  name: string;
  usage: string;
  changes: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <div>
        <h3 className="font-display-tight text-lg font-medium text-fg">{name}</h3>
        <p className="mt-1 text-xs text-fg-muted">
          <span className="text-fg-subtle">Used for · </span>
          {usage}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-fg-subtle">
          <span className="font-medium text-fg-muted">Retheme · </span>
          {changes}
        </p>
      </div>
      <Themed>{children}</Themed>
    </div>
  );
}

function TracingBeamSample() {
  const scrollRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={scrollRef}
      className="scrollbar-thin h-64 overflow-y-auto rounded-md border border-line bg-surface-1 p-4"
    >
      <TracingBeam scrollContainer={scrollRef}>
        <div className="flex flex-col gap-8 pb-24">
          {["Ingestion", "Retrieval", "Threshold", "Generation"].map((title, index) => (
            <div key={title}>
              <p className="font-mono text-2xs text-brand-ink">
                {String(index + 1).padStart(2, "0")}
              </p>
              <p className="font-display-tight text-base font-medium text-fg">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-fg-muted">
                Scroll inside this box: the beam follows the container, not the window.
              </p>
            </div>
          ))}
        </div>
      </TracingBeam>
    </div>
  );
}
