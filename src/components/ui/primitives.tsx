import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/* Surface ---------------------------------------------------------------------------------------*/

export const surfaceVariants = cva("relative border", {
  variants: {
    level: {
      sunken: "border-line bg-sunken",
      1: "border-line bg-surface-1",
      2: "border-line bg-surface-2 shadow-1",
      3: "border-line-strong bg-surface-3 shadow-2",
    },
    radius: {
      sm: "rounded-sm",
      md: "rounded-md",
      lg: "rounded-lg",
      xl: "rounded-xl",
    },
  },
  defaultVariants: { level: 2, radius: "lg" },
});

export interface SurfaceProps
  extends React.ComponentProps<"div">, VariantProps<typeof surfaceVariants> {}

export function Surface({ className, level, radius, ...props }: SurfaceProps) {
  return <div className={cn(surfaceVariants({ level, radius }), className)} {...props} />;
}

/* Kbd -------------------------------------------------------------------------------------------*/

export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-line-strong bg-surface-2 px-1 font-mono text-2xs font-medium text-fg-muted shadow-[0_1px_0_var(--line-strong)]",
        className,
      )}
      {...props}
    />
  );
}

/* Skeleton --------------------------------------------------------------------------------------*/

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      className={cn(
        "rounded-sm bg-[linear-gradient(90deg,var(--surface-3)_0%,color-mix(in_oklab,var(--surface-3),var(--fg)_7%)_50%,var(--surface-3)_100%)] bg-[length:220%_100%] motion-safe:animate-shimmer",
        className,
      )}
      {...props}
    />
  );
}

/* Section label ---------------------------------------------------------------------------------*/

export function Eyebrow({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("eyebrow", className)} {...props} />;
}

/* Thinking indicator ----------------------------------------------------------------------------*/

/** Three dots that breathe in sequence. Static under reduced motion. */
export function ThinkingDots({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)} aria-hidden>
      {[0, 160, 320].map((delay) => (
        <span
          key={delay}
          className="size-1.5 rounded-full bg-brand motion-safe:animate-pulse-soft"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}

/* Separator -------------------------------------------------------------------------------------*/

export function Separator({
  orientation = "horizontal",
  className,
}: {
  orientation?: "horizontal" | "vertical";
  className?: string;
}) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        "shrink-0 bg-line",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
    />
  );
}
