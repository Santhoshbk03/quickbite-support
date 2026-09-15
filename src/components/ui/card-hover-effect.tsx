"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useState } from "react";

import { cn } from "@/lib/utils";

export interface HoverEffectItem {
  id: string;
  title: string;
  description: string;
  eyebrow?: React.ReactNode;
  trailing?: React.ReactNode;
}

/**
 * Aceternity Card Hover Effect, rethemed.
 *
 * Kept: one shared highlight that glides between cards (a single layoutId).
 * Changed: cards are buttons rather than links, the highlight follows keyboard focus as well as the
 * pointer, surfaces and borders come from tokens instead of black/slate, and under reduced motion
 * the highlight fades in place instead of travelling.
 */
export function HoverEffect({
  items,
  onSelect,
  className,
}: {
  items: HoverEffectItem[];
  onSelect: (item: HoverEffectItem) => void;
  className?: string;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();
  const layoutGroup = useId();

  return (
    <ul className={cn("grid grid-cols-1 gap-1 sm:grid-cols-2 xl:grid-cols-3", className)}>
      {items.map((item) => (
        <li key={item.id} className="relative">
          <button
            type="button"
            onClick={() => onSelect(item)}
            onPointerEnter={() => setActiveId(item.id)}
            onPointerLeave={() => setActiveId((current) => (current === item.id ? null : current))}
            onFocus={() => setActiveId(item.id)}
            onBlur={() => setActiveId((current) => (current === item.id ? null : current))}
            className="group relative block h-full w-full rounded-lg p-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <AnimatePresence>
              {activeId === item.id ? (
                <motion.span
                  aria-hidden
                  layoutId={reduceMotion ? undefined : `${layoutGroup}-highlight`}
                  className="absolute inset-0 block rounded-lg bg-brand-soft"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: 0.15 } }}
                  exit={{ opacity: 0, transition: { duration: 0.15, delay: 0.12 } }}
                />
              ) : null}
            </AnimatePresence>
            <span className="relative z-10 flex h-full flex-col gap-2 rounded-md border border-line bg-surface-1 p-4 shadow-1 transition-colors duration-150 group-hover:border-brand-line group-focus-visible:border-brand-line">
              {item.eyebrow ? (
                <span className="flex items-center justify-between">{item.eyebrow}</span>
              ) : null}
              <span className="text-[0.9375rem] font-medium leading-snug text-fg">
                {item.title}
              </span>
              <span className="text-[0.8125rem] leading-relaxed text-fg-subtle">
                {item.description}
              </span>
              {item.trailing ? <span className="mt-auto pt-1">{item.trailing}</span> : null}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
