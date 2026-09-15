"use client";

import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TracingBeam } from "@/components/ui/tracing-beam";
import { EVALS, getRun } from "@/lib/evals";
import { useUiStore } from "@/lib/ui/store";

interface Step {
  title: string;
  body: string;
  tradeoff: { label: string; text: string };
}

const precisionFrom = getRun(EVALS.baseline_run_id).scores.context_precision;
const precisionTo = getRun(EVALS.current_run_id).scores.context_precision;

const STEPS: Step[] = [
  {
    title: "Ingestion: policies become citable chunks",
    body: "Policy documents are split along their headings into short, self-contained chunks, each tagged with its document, section, and version. Chunks are embedded once, at ingestion, and stored in a ChromaDB collection.",
    tradeoff: {
      label: "Trade-off",
      text: "Heading-aware chunks can be cited on their own, at the cost of uneven sizes. Context recall in the eval harness is what catches a chunk that got split badly.",
    },
  },
  {
    title: "Retrieval: nearest chunks by distance",
    body: "A follow-up question is first rewritten into a standalone query, so “can I cancel it instead?” carries its context. The query is embedded with the same model and the top-k closest chunks come back with their distances.",
    tradeoff: {
      label: "Why ChromaDB",
      text: "Embedded, zero-ops, and more than fast enough at this corpus size. A managed vector database would add network latency and cost without improving retrieval quality here.",
    },
  },
  {
    title: "Threshold: refuse instead of guessing",
    body: "Any chunk further than the distance threshold is discarded. If nothing survives, the pipeline returns a refusal carrying the nearest miss and its score, and never calls the language model at all.",
    tradeoff: {
      label: "Why a distance threshold",
      text: "It is deterministic, costs nothing, and removes hallucination risk for out-of-scope questions. The price is the occasional false refusal of an oddly-phrased in-scope question, which the eval harness counts so the threshold is tuned on data rather than feel.",
    },
  },
  {
    title: "Tools: live order data mid-answer",
    body: "When a question names an order, the model calls lookup_order partway through its answer. The structured result streams to this interface as its own event and renders as an order card, positioned exactly where the call happened.",
    tradeoff: {
      label: "Design note",
      text: "Tool results are context, not authority: history sent back by the client is never trusted for anything with side effects.",
    },
  },
  {
    title: "Generation: Groq, with Ollama as the fallback",
    body: "Groq serves the primary model for a fast first token. If it rate-limits or errors, the same prompt is retried on a self-hosted Ollama model, and the response metadata records that the fallback served it.",
    tradeoff: {
      label: "Trade-off",
      text: "The fallback is slower and smaller, but a slower answer beats an error page, and the inspector shows exactly when it happened.",
    },
  },
  {
    title: "Streaming: one contract, two implementations",
    body: "Answers stream over server-sent events as typed events: tokens, retrieval, citations, tool calls, refusals, and final metadata. This frontend validates every event with Zod against a published contract. The demo runs on a mock backend that implements that same contract, which is why it keeps working while a live backend sleeps.",
    tradeoff: {
      label: "Design note",
      text: "A conformance script replays the scenario suite through a real SSE round trip and checks the output is identical, so the mock cannot quietly drift from the contract.",
    },
  },
  {
    title: "Observability: every answer is a trace",
    body: "Each response is a Langfuse trace with spans for embedding, retrieval, filtering, tools, and generation. The inspector's latency waterfall is drawn from those same spans and deep-links to the trace.",
    tradeoff: {
      label: "Design note",
      text: "The conversation id is the Langfuse session id, so a whole multi-turn exchange reads as one session.",
    },
  },
  {
    title: "Evals: measured, then changed",
    body: `A golden set of support questions is scored for faithfulness, answer relevancy, context precision, and context recall. Cutting top-k from 5 to 3 lifted context precision from ${precisionFrom.toFixed(2)} to ${precisionTo.toFixed(2)}.`,
    tradeoff: {
      label: "What it cost",
      text:
        EVALS.headline?.tradeoff ??
        "Fewer chunks means less noise for the model, and occasionally less coverage.",
    },
  },
];

export function ArchitectureWalkthrough({
  scrollContainer,
}: {
  scrollContainer: React.RefObject<HTMLElement | null>;
}) {
  const setTab = useUiStore((state) => state.setHowItWorksTab);

  return (
    <TracingBeam scrollContainer={scrollContainer}>
      <div className="flex flex-col gap-10">
        <section aria-labelledby="architecture-overview">
          <h3 id="architecture-overview" className="font-display-tight text-xl font-medium text-fg">
            Two pipelines, one contract
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-muted">
            Ingestion runs offline and turns policy documents into an index. The query pipeline runs
            per request and either answers from that index, calls a tool, or refuses. Everything it
            does is streamed as typed events and traced.
          </p>
          <ArchitectureDiagram className="mt-5" />
        </section>

        {STEPS.map((step, index) => (
          <section key={step.title} aria-labelledby={`step-${index}`} className="max-w-2xl">
            <p className="font-mono text-2xs tabular text-brand-ink">
              {String(index + 1).padStart(2, "0")}
            </p>
            <h3
              id={`step-${index}`}
              className="mt-1 font-display-tight text-lg font-medium text-fg"
            >
              {step.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">{step.body}</p>
            <div className="mt-3 rounded-md border border-line bg-surface-2 px-4 py-3">
              <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-fg-subtle">
                {step.tradeoff.label}
              </p>
              <p className="mt-1 text-[0.8125rem] leading-relaxed text-fg-muted">
                {step.tradeoff.text}
              </p>
            </div>
            {index === STEPS.length - 1 ? (
              <Button variant="subtle" size="sm" className="mt-4" onClick={() => setTab("evals")}>
                See the eval results
                <ArrowRight aria-hidden />
              </Button>
            ) : null}
          </section>
        ))}
      </div>
    </TracingBeam>
  );
}

/* Diagram --------------------------------------------------------------------------------------*/

function Node({
  x,
  y,
  width,
  title,
  subtitle,
  tone = "default",
}: {
  x: number;
  y: number;
  width: number;
  title: string;
  subtitle: string;
  tone?: "default" | "brand" | "quiet";
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={50}
        rx={10}
        fill={
          tone === "brand"
            ? "var(--brand-soft)"
            : tone === "quiet"
              ? "var(--surface-1)"
              : "var(--surface-2)"
        }
        stroke={tone === "brand" ? "var(--brand-line)" : "var(--line-strong)"}
        strokeDasharray={tone === "quiet" ? "4 3" : undefined}
      />
      <text x={x + 13} y={y + 21} fontSize="12.5" fontWeight="600" fill="var(--fg)">
        {title}
      </text>
      <text x={x + 13} y={y + 38} fontSize="10.5" fill="var(--fg-subtle)">
        {subtitle}
      </text>
    </g>
  );
}

function Lane({ y, height, label }: { y: number; height: number; label: string }) {
  return (
    <g>
      <rect
        x={4}
        y={y}
        width={892}
        height={height}
        rx={14}
        fill="var(--surface-sunken)"
        stroke="var(--line)"
      />
      <text
        x={18}
        y={y + 19}
        fontSize="9.5"
        fontWeight="600"
        letterSpacing="0.9"
        fill="var(--fg-subtle)"
      >
        {label}
      </text>
    </g>
  );
}

export function ArchitectureDiagram({ className }: { className?: string }) {
  const arrow = {
    stroke: "var(--fg-subtle)",
    strokeWidth: 1.25,
    fill: "none",
    markerEnd: "url(#qb-arrow)",
  };
  const brandArrow = {
    stroke: "var(--brand)",
    strokeWidth: 1.5,
    fill: "none",
    markerEnd: "url(#qb-arrow-brand)",
  };

  return (
    <figure className={className}>
      <div className="scrollbar-thin overflow-x-auto rounded-lg border border-line bg-surface-1 p-2">
        <svg
          viewBox="0 0 900 470"
          className="h-auto w-full min-w-[720px] font-sans"
          role="img"
          aria-labelledby="architecture-title architecture-desc"
        >
          <title id="architecture-title">QuickBite Support architecture</title>
          <desc id="architecture-desc">
            Ingestion: policy documents are chunked, embedded, and stored in ChromaDB. Query: the
            question is rewritten, embedded, and searched in ChromaDB for the top 3 chunks; a
            distance threshold either passes chunks to generation on Groq with an Ollama fallback,
            which can call the lookup_order tool, or produces a refusal without a model call. Both
            paths stream typed events to the interface. Langfuse traces every stage and an eval
            harness scores the pipeline.
          </desc>
          <defs>
            <marker
              id="qb-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--fg-subtle)" />
            </marker>
            <marker
              id="qb-arrow-brand"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--brand)" />
            </marker>
          </defs>

          <Lane y={4} height={100} label="INGESTION · OFFLINE" />
          <Node x={16} y={36} width={156} title="Policy documents" subtitle="26 markdown files" />
          <Node x={208} y={36} width={150} title="Chunker" subtitle="heading-aware" />
          <Node x={394} y={36} width={150} title="Embedding model" subtitle="sentence vectors" />
          <Node x={580} y={36} width={160} title="ChromaDB" subtitle="cosine index" tone="brand" />
          <path d="M172 61 H206" {...arrow} />
          <path d="M358 61 H392" {...arrow} />
          <path d="M544 61 H578" {...arrow} />

          <Lane y={118} height={246} label="QUERY · PER REQUEST" />
          <Node x={16} y={182} width={112} title="Question" subtitle="+ chat history" />
          <Node x={150} y={182} width={122} title="Rewrite" subtitle="standalone query" />
          <Node x={294} y={182} width={130} title="Embed + search" subtitle="top-k = 3" />
          <Node
            x={446}
            y={182}
            width={130}
            title="Threshold"
            subtitle="distance ≤ 0.55"
            tone="brand"
          />
          <Node x={600} y={182} width={160} title="Generate" subtitle="Groq → Ollama fallback" />
          <Node x={784} y={182} width={100} title="Stream" subtitle="SSE → this UI" />
          <path d="M128 207 H148" {...brandArrow} />
          <path d="M272 207 H292" {...brandArrow} />
          <path d="M424 207 H444" {...brandArrow} />
          <path d="M576 207 H598" {...brandArrow} />
          <path d="M760 207 H782" {...brandArrow} />
          <text x={560} y={176} fontSize="10" fill="var(--fg-subtle)">
            passes
          </text>

          <path d="M359 182 V140 H660 V88" {...arrow} strokeDasharray="4 3" />
          <text x={440} y={134} fontSize="10" fill="var(--fg-subtle)">
            nearest chunks + distances
          </text>

          <Node x={446} y={268} width={130} title="Refusal" subtitle="no model call" tone="quiet" />
          <path d="M511 232 V266" {...arrow} />
          <text x={404} y={254} fontSize="10" fill="var(--fg-subtle)">
            nothing passes
          </text>

          <Node x={610} y={268} width={140} title="lookup_order" subtitle="live order data" />
          <path d="M680 234 V266" {...arrow} markerStart="url(#qb-arrow)" />
          <text x={688} y={254} fontSize="10" fill="var(--fg-subtle)">
            tool call
          </text>

          <path d="M511 318 V340 H834 V234" {...arrow} />
          <text x={596} y={354} fontSize="10" fill="var(--fg-subtle)">
            refusal event, same stream
          </text>

          <Lane y={378} height={86} label="QUALITY & OBSERVABILITY" />
          <Node
            x={16}
            y={404}
            width={236}
            title="Langfuse"
            subtitle="a trace per answer, a span per stage"
          />
          <Node
            x={272}
            y={404}
            width={290}
            title="Eval harness"
            subtitle="faithfulness · relevancy · precision · recall"
            tone="brand"
          />
          <Node
            x={582}
            y={404}
            width={302}
            title="Contract checks"
            subtitle="Zod schemas · SSE round-trip conformance"
          />
        </svg>
      </div>
      <figcaption className="mt-2 text-2xs text-fg-subtle">
        Saffron arrows are the answer path. Dashed boxes never call the model.
      </figcaption>
    </figure>
  );
}
