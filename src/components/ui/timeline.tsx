"use client";

import { Check, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

export interface TimelineStep {
  id: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  detail?: React.ReactNode;
  state: "complete" | "current" | "upcoming" | "skipped";
  tone?: "default" | "danger";
}

/**
 * Aceternity Timeline, rethemed and condensed for an order status card.
 *
 * Kept: the vertical rail with a gradient beam that fills to show progress.
 * Changed: the stock timeline is a full-page, scroll-driven changelog with sticky 5xl headings.
 * Inside a chat card that is the wrong scale, so the beam now fills to the *current step* once, on
 * mount, driven by order state rather than scroll position. Purple/blue gradient becomes saffron,
 * and under reduced motion the beam is drawn at its final length.
 */
export function Timeline({ steps, className }: { steps: TimelineStep[]; className?: string }) {
  const reduceMotion = useReducedMotion();
  const currentIndex = Math.max(
    0,
    steps.findLastIndex((step) => step.state === "complete" || step.state === "current"),
  );
  const progress = steps.length > 1 ? currentIndex / (steps.length - 1) : 1;
  const failed = steps.some((step) => step.tone === "danger" && step.state !== "upcoming");

  return (
    <div className={cn("relative", className)}>
      {/* Rail and beam, centred on the 20px markers. */}
      <div aria-hidden className="absolute bottom-3 left-[9.5px] top-3 w-px bg-line-strong">
        <motion.div
          className={cn(
            "absolute inset-x-0 top-0 h-full origin-top bg-gradient-to-b",
            failed ? "from-brand via-danger to-danger" : "from-brand via-brand to-brand-line",
          )}
          initial={reduceMotion ? { scaleY: progress } : { scaleY: 0 }}
          animate={{ scaleY: progress }}
          transition={{ duration: reduceMotion ? 0 : 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        />
      </div>

      <ol className="relative flex flex-col gap-3.5">
        {steps.map((step) => (
          <li key={step.id} className="flex gap-3">
            <Marker state={step.state} tone={step.tone ?? "default"} />
            <div className="min-w-0 flex-1 pt-px">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span
                  className={cn(
                    "text-[0.8125rem] leading-5",
                    step.state === "current" ? "font-medium text-fg" : "text-fg-muted",
                    step.state === "upcoming" && "text-fg-subtle",
                    step.state === "skipped" && "text-fg-subtle line-through",
                  )}
                >
                  {step.title}
                </span>
                {step.meta ? (
                  <span className="font-mono text-2xs tabular text-fg-subtle">{step.meta}</span>
                ) : null}
              </div>
              {step.detail ? (
                <p className="mt-0.5 text-xs leading-relaxed text-fg-subtle">{step.detail}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Marker({ state, tone }: { state: TimelineStep["state"]; tone: "default" | "danger" }) {
  if (tone === "danger" && state !== "upcoming") {
    return (
      <span className="relative flex size-5 shrink-0 items-center justify-center rounded-full bg-danger text-canvas">
        <X className="size-3" strokeWidth={3} aria-hidden />
      </span>
    );
  }
  if (state === "complete") {
    return (
      <span className="relative flex size-5 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand">
        <Check className="size-3" strokeWidth={3} aria-hidden />
      </span>
    );
  }
  if (state === "current") {
    return (
      <span className="relative flex size-5 shrink-0 items-center justify-center rounded-full border border-brand bg-canvas">
        <span className="absolute inset-0 rounded-full bg-brand-soft motion-safe:animate-ping" />
        <span className="relative size-2 rounded-full bg-brand" />
      </span>
    );
  }
  return (
    <span className="relative flex size-5 shrink-0 items-center justify-center rounded-full border border-line-strong bg-canvas">
      <span className="size-1.5 rounded-full bg-line-strong" />
    </span>
  );
}
