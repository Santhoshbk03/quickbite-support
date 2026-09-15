"use client";

import { motion, useMotionValueEvent, useScroll, useSpring, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Aceternity Tracing Beam, rethemed.
 *
 * Kept: the beam that follows scroll progress down a stepped guide line.
 * Changed: works inside a scrolling drawer (`scrollContainer`) rather than only the window; height is
 * measured with a ResizeObserver so it stays correct as sections expand; the start dot is driven by
 * a motion-value event rather than reading `.get()` during render; cyan/violet stops become saffron;
 * and the moving beam is hidden under reduced motion, leaving the static guide.
 */
export function TracingBeam({
  children,
  className,
  scrollContainer,
}: {
  children: React.ReactNode;
  className?: string;
  scrollContainer?: React.RefObject<HTMLElement | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const element = contentRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setHeight(entry.contentRect.height);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const { scrollYProgress } = useScroll({
    target: ref,
    container: scrollContainer,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (value) => setStarted(value > 0.01));

  const y1 = useSpring(useTransform(scrollYProgress, [0, 0.8], [50, height]), {
    stiffness: 500,
    damping: 90,
  });
  const y2 = useSpring(useTransform(scrollYProgress, [0, 1], [50, Math.max(50, height - 160)]), {
    stiffness: 500,
    damping: 90,
  });

  return (
    <div ref={ref} className={cn("relative w-full", className)}>
      <div aria-hidden className="absolute -left-1 top-2 hidden sm:block">
        <span
          className={cn(
            "ml-[3px] flex size-4 items-center justify-center rounded-full border transition-colors duration-200",
            started ? "border-line-strong" : "border-brand-line shadow-2",
          )}
        >
          <span
            className={cn(
              "size-2 rounded-full border transition-colors duration-200",
              started ? "border-line-strong bg-surface-2" : "border-brand bg-brand",
            )}
          />
        </span>
        <svg viewBox={`0 0 20 ${height}`} width="20" height={height} className="block">
          <path
            d={`M 1 0V -36 l 18 24 V ${height * 0.8} l -18 24V ${height}`}
            fill="none"
            stroke="var(--line-strong)"
          />
          <motion.path
            d={`M 1 0V -36 l 18 24 V ${height * 0.8} l -18 24V ${height}`}
            fill="none"
            stroke="url(#qb-tracing-beam)"
            strokeWidth="1.5"
            className="motion-reduce:hidden"
          />
          <defs>
            <motion.linearGradient
              id="qb-tracing-beam"
              gradientUnits="userSpaceOnUse"
              x1="0"
              x2="0"
              y1={y1}
              y2={y2}
            >
              <stop stopColor="var(--brand)" stopOpacity="0" />
              <stop stopColor="var(--brand)" />
              <stop offset="0.4" stopColor="var(--brand-hover)" />
              <stop offset="1" stopColor="var(--brand)" stopOpacity="0" />
            </motion.linearGradient>
          </defs>
        </svg>
      </div>
      <div ref={contentRef} className="sm:pl-12">
        {children}
      </div>
    </div>
  );
}
