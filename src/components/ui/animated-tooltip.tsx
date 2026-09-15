"use client";

import { Tooltip } from "@base-ui/react/tooltip";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";

import { cn } from "@/lib/utils";

/**
 * Aceternity Animated Tooltip, rethemed and re-platformed for citation previews.
 *
 * Kept: the signature pointer-following tilt and the gradient underline.
 * Changed: the stock version positions an absolute box above an avatar, which clips inside any
 * scrolling container (like a chat thread). This one sits on Base UI's tooltip for portal
 * rendering, collision-aware positioning, focus-to-open, and aria-describedby. The tilt is toned
 * down from ±45° to ±5°, the colours come from tokens, and it is static under reduced motion.
 * On touch devices tooltips never open, so a tap goes straight to the trigger's click action.
 */
export function AnimatedTooltip({
  content,
  children,
  side = "top",
  className,
}: {
  content: React.ReactNode;
  /** A single element that accepts a ref, e.g. a button. */
  children: React.ReactElement;
  side?: "top" | "bottom";
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const pointerX = useMotionValue(0);
  const spring = { stiffness: 180, damping: 18 };
  const rotate = useSpring(useTransform(pointerX, [-60, 60], [-5, 5]), spring);
  const translateX = useSpring(useTransform(pointerX, [-60, 60], [-10, 10]), spring);

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    pointerX.set(event.clientX - rect.left - rect.width / 2);
  };

  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={children}
        onPointerMove={onPointerMove}
        delay={120}
        closeDelay={80}
      />
      <Tooltip.Portal>
        <Tooltip.Positioner side={side} sideOffset={10} collisionPadding={12} className="z-[70]">
          <Tooltip.Popup className="transition-[opacity,transform] duration-200 ease-out data-[starting-style]:translate-y-1 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0">
            <motion.div
              style={reduceMotion ? undefined : { rotate, translateX }}
              className={cn(
                "relative w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-md border border-line-strong bg-surface-3 p-3.5 text-left shadow-3",
                className,
              )}
            >
              <span
                aria-hidden
                className="absolute inset-x-8 -bottom-px h-px bg-gradient-to-r from-transparent via-brand to-transparent"
              />
              {content}
            </motion.div>
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
