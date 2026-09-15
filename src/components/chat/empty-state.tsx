"use client";

import {
  ArrowRight,
  Ban,
  BookOpenText,
  Gauge,
  LifeBuoy,
  Play,
  ReceiptText,
  Repeat2,
  ScanSearch,
  Sparkles,
  Truck,
  Workflow,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { BentoGrid, BentoGridItem } from "@/components/ui/bento-grid";
import { Button } from "@/components/ui/button";
import { HoverEffect } from "@/components/ui/card-hover-effect";
import { InfiniteMovingCards } from "@/components/ui/infinite-moving-cards";
import { Spotlight } from "@/components/ui/spotlight";
import { useChatStore } from "@/lib/chat/store";
import { EVALS } from "@/lib/evals";
import { EXAMPLE_QUESTIONS, KNOWLEDGE_DOCUMENTS } from "@/lib/fixtures";
import type { Capability } from "@/lib/fixtures";
import { useUiStore } from "@/lib/ui/store";

const CAPABILITY: Record<
  Capability,
  { label: string; icon: React.ReactNode; tone: "brand" | "neutral" | "info" }
> = {
  policy: { label: "Policy", icon: <BookOpenText aria-hidden />, tone: "neutral" },
  refund: { label: "Refund case", icon: <ReceiptText aria-hidden />, tone: "neutral" },
  tool_use: { label: "Tool call", icon: <Truck aria-hidden />, tone: "neutral" },
  multi_turn: { label: "Tool call · multi-turn", icon: <Repeat2 aria-hidden />, tone: "neutral" },
  refusal: { label: "Out of scope", icon: <Ban aria-hidden />, tone: "brand" },
};

const MULTI_TURN_SESSION = "conv_demo_late_order_followups";

export function EmptyState() {
  const send = useChatStore((state) => state.send);
  const replay = useChatStore((state) => state.replay);
  const busy = useChatStore(
    (state) => state.streamingTurnId !== null || state.replayingId !== null,
  );
  const openHowItWorks = useUiStore((state) => state.openHowItWorks);

  const baseline = EVALS.runs.find((run) => run.id === EVALS.baseline_run_id);
  const current = EVALS.runs.find((run) => run.id === EVALS.current_run_id);
  const precisionFrom = baseline?.scores.context_precision;
  const precisionTo = current?.scores.context_precision;

  return (
    <div className="relative isolate overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-dot-grid mask-radial"
      />
      <Spotlight className="-top-44 left-0 md:-top-32 md:left-48" />

      <div className="mx-auto flex max-w-5xl flex-col px-4 pb-12 pt-10 sm:px-8 sm:pt-16">
        <section aria-labelledby="hero-title" className="max-w-3xl">
          <Badge tone="brand" className="mb-5">
            <Sparkles aria-hidden />
            Retrieval-augmented support agent
          </Badge>
          <h1
            id="hero-title"
            className="font-display-tight text-[2.5rem] font-medium leading-[1.04] text-fg sm:text-[3.4rem]"
          >
            Answers from policy.
            <br />
            <span className="text-fg-subtle">Or an honest </span>
            <span className="italic text-brand-ink">no.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-[1.0625rem] leading-relaxed text-fg-muted">
            QuickBite Support answers delivery, refund, and order questions from{" "}
            {KNOWLEDGE_DOCUMENTS.length} policy documents and live order data — and shows its work.
            Every source, distance, tool call, and millisecond is one click away.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-2.5">
            <Button
              variant="primary"
              size="lg"
              disabled={busy}
              onClick={() => void replay(MULTI_TURN_SESSION)}
            >
              <Play aria-hidden className="fill-current" />
              Watch a recorded session
            </Button>
            <Button variant="secondary" size="lg" onClick={() => openHowItWorks("architecture")}>
              <Workflow aria-hidden />
              How it works
            </Button>
          </div>
        </section>

        <section aria-labelledby="examples-title" className="mt-14">
          <div className="mb-3 flex items-end justify-between gap-4 px-1.5">
            <div>
              <h2 id="examples-title" className="font-display-tight text-xl font-medium text-fg">
                Try a question
              </h2>
              <p className="mt-1 text-[0.8125rem] text-fg-subtle">
                Each one exercises a different part of the pipeline — including one it should
                refuse.
              </p>
            </div>
          </div>
          <HoverEffect
            className="-mx-1.5"
            items={EXAMPLE_QUESTIONS.map((example) => ({
              id: example.id,
              title: example.question,
              description: example.demonstrates,
              eyebrow: (
                <>
                  <Badge tone={CAPABILITY[example.capability].tone} size="sm">
                    {CAPABILITY[example.capability].icon}
                    {example.improvised
                      ? "Improvised · not scripted"
                      : CAPABILITY[example.capability].label}
                  </Badge>
                  <ArrowRight
                    className="size-3.5 text-fg-subtle transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-brand-ink"
                    aria-hidden
                  />
                </>
              ),
            }))}
            onSelect={(item) => {
              if (busy) return;
              const example = EXAMPLE_QUESTIONS.find((candidate) => candidate.id === item.id);
              if (example) void send(example.question);
            }}
          />
        </section>

        <section aria-labelledby="capabilities-title" className="mt-14">
          <h2
            id="capabilities-title"
            className="mb-3 px-0.5 font-display-tight text-xl font-medium text-fg"
          >
            What it is actually doing
          </h2>
          <BentoGrid>
            <BentoGridItem
              className="md:col-span-2"
              icon={<ScanSearch aria-hidden />}
              title="Grounded retrieval, with the receipts"
              description="Questions are embedded and matched against policy chunks in ChromaDB. Citations are inline; hover for the snippet, click for the full chunk and its similarity distance."
              header={<DistancePreview />}
            />
            <BentoGridItem
              icon={<LifeBuoy aria-hidden />}
              title="Refuses below threshold"
              description="If no chunk is close enough, the model is never called. You get a calm refusal and the nearest miss — not a confident guess."
            />
            <BentoGridItem
              icon={<Truck aria-hidden />}
              title="Real tool calls"
              description="Order questions call lookup_order mid-answer. The result renders as a live order card, with the raw payload one click away."
            />
            <BentoGridItem
              icon={<Gauge aria-hidden />}
              title="Measured, then tuned"
              description={
                precisionFrom !== undefined && precisionTo !== undefined
                  ? `An eval harness scores every change. Cutting top-k from 5 to 3 moved context precision from ${precisionFrom.toFixed(2)} to ${precisionTo.toFixed(2)}.`
                  : "An eval harness scores faithfulness, relevancy, and context quality on a golden set."
              }
            />
            <BentoGridItem
              icon={<Workflow aria-hidden />}
              title="Nothing hidden"
              description="The inspector shows ranked chunks against the threshold, a latency waterfall, token cost, and the Langfuse trace for any answer."
            />
          </BentoGrid>
        </section>

        <section className="mt-14">
          <p className="mb-3 px-0.5 text-[0.8125rem] text-fg-subtle">
            Grounded in {KNOWLEDGE_DOCUMENTS.length} QuickBite policy documents
          </p>
          <InfiniteMovingCards
            label="Policy documents in the knowledge base"
            items={KNOWLEDGE_DOCUMENTS.map((document) => ({
              id: document.id,
              label: document.title,
              meta: document.version ?? undefined,
            }))}
          />
        </section>
      </div>
    </div>
  );
}

/** A static miniature of the inspector's distance scale, so the bento card shows rather than tells. */
function DistancePreview() {
  const rows = [
    { label: "Late Delivery Compensation", distance: 0.238, cited: true },
    { label: "Late Delivery Compensation · exemptions", distance: 0.327, cited: true },
    { label: "Severe Weather & Service Disruptions", distance: 0.492, cited: false },
    { label: "Rider Conduct & Safety Standards", distance: 0.612, cited: false },
  ];
  const threshold = 0.55;
  return (
    <div aria-hidden className="rounded-md border border-line bg-sunken p-3">
      <div className="relative mb-2 h-1.5 rounded-full bg-surface-3">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-brand-soft"
          style={{ width: `${threshold * 100}%` }}
        />
        <div
          className="absolute -inset-y-1 w-px bg-brand"
          style={{ left: `${threshold * 100}%` }}
        />
        {rows.map((row) => (
          <span
            key={row.label}
            className={`absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border ${
              row.distance <= threshold
                ? "border-brand bg-brand"
                : "border-line-strong bg-surface-2"
            }`}
            style={{ left: `${row.distance * 100}%` }}
          />
        ))}
      </div>
      <ul className="flex flex-col gap-1">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-2 text-2xs">
            <span
              className={`size-1.5 rounded-full ${row.cited ? "bg-brand" : row.distance <= threshold ? "bg-fg-subtle" : "bg-line-strong"}`}
            />
            <span
              className={`min-w-0 flex-1 truncate ${row.distance <= threshold ? "text-fg-muted" : "text-fg-subtle"}`}
            >
              {row.label}
            </span>
            <span className="font-mono tabular text-fg-subtle">{row.distance.toFixed(3)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
