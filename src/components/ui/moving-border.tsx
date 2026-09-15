"use client";

import {
  motion,
  useAnimationFrame,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { useRef } from "react";

import { cn } from "@/lib/utils";

/**
 * Aceternity Moving Border, rethemed. Used in exactly one place: the demo/live status badge.
 *
 * Changes from stock: saffron instead of sky blue, a static hairline underneath so the badge still
 * has an edge when the light is on the far side, no glassmorphism blur, typed props instead of
 * `any`, and under reduced motion the orbiting light is simply not rendered.
 */
export function MovingBorder({
  children,
  className,
  innerClassName,
  duration = 4800,
  radius = 14,
}: {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  /** Milliseconds for one lap. Slow on purpose: it should be noticed, not watched. */
  duration?: number;
  /** Corner radius in px; the orbit path follows it. */
  radius?: number;
}) {
  return (
    <span
      className={cn("relative inline-flex overflow-hidden p-px", className)}
      style={{ borderRadius: radius }}
    >
      <span
        aria-hidden
        className="absolute inset-0 bg-line-strong"
        style={{ borderRadius: radius }}
      />
      <span aria-hidden className="absolute inset-0" style={{ borderRadius: radius }}>
        <Orbit duration={duration} radius={radius}>
          <span className="block size-9 bg-[radial-gradient(var(--brand)_32%,transparent_68%)] opacity-90" />
        </Orbit>
      </span>
      <span
        className={cn("relative inline-flex items-center bg-surface-2", innerClassName)}
        style={{ borderRadius: radius - 1 }}
      >
        {children}
      </span>
    </span>
  );
}

function Orbit({
  children,
  duration,
  radius,
}: {
  children: React.ReactNode;
  duration: number;
  radius: number;
}) {
  const pathRef = useRef<SVGRectElement>(null);
  const progress = useMotionValue(0);
  const reduceMotion = useReducedMotion();

  useAnimationFrame((time) => {
    if (reduceMotion) return;
    const length = pathRef.current?.getTotalLength();
    if (length) progress.set((time * (length / duration)) % length);
  });

  const x = useTransform(progress, (value) => pathRef.current?.getPointAtLength(value).x ?? 0);
  const y = useTransform(progress, (value) => pathRef.current?.getPointAtLength(value).y ?? 0);
  const transform = useMotionTemplate`translateX(${x}px) translateY(${y}px) translateX(-50%) translateY(-50%)`;

  if (reduceMotion) return null;

  return (
    <>
      <svg
        className="absolute size-full"
        preserveAspectRatio="none"
        width="100%"
        height="100%"
        aria-hidden
      >
        <rect ref={pathRef} fill="none" width="100%" height="100%" rx={radius} ry={radius} />
      </svg>
      <motion.span className="absolute left-0 top-0 inline-block" style={{ transform }}>
        {children}
      </motion.span>
    </>
  );
}
