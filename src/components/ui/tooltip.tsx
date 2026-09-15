"use client";

import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";

import { cn } from "@/lib/utils";

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return (
    <BaseTooltip.Provider delay={380} closeDelay={60}>
      {children}
    </BaseTooltip.Provider>
  );
}

export interface TooltipProps {
  content: React.ReactNode;
  /** A single element that receives the trigger props (it must accept a ref). */
  children: React.ReactElement;
  side?: "top" | "bottom" | "left" | "right";
  sideOffset?: number;
  className?: string;
}

/** Plain label tooltip for icon buttons. Keyboard focus opens it too. */
export function Tooltip({
  content,
  children,
  side = "top",
  sideOffset = 8,
  className,
}: TooltipProps) {
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner side={side} sideOffset={sideOffset} className="z-[70]">
          <BaseTooltip.Popup
            className={cn(
              "origin-[var(--transform-origin)] rounded-xs border border-line-strong bg-surface-3 px-2 py-1 text-xs font-medium text-fg shadow-2",
              "transition-[opacity,transform] duration-150 ease-out",
              "data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
              className,
            )}
          >
            {content}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}
