import { useId } from "react";

import { cn } from "@/lib/utils";

/** The QuickBite mark: a saffron disc with a bite taken out of it. */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  const maskId = useId();
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-7 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <mask id={maskId}>
          <rect width="32" height="32" fill="white" />
          <circle cx="26.2" cy="8.2" r="4.6" fill="black" />
          <circle cx="21.6" cy="3.6" r="2.7" fill="black" />
          <circle cx="29.8" cy="12.9" r="2.7" fill="black" />
        </mask>
      </defs>
      <circle cx="15.5" cy="16.5" r="13.5" fill="var(--brand)" mask={`url(#${maskId})`} />
      <path
        d="M10.4 17.2c1.4 2.3 3.2 3.4 5.3 3.4s3.9-1.1 5.3-3.4"
        fill="none"
        stroke="var(--on-brand)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Wordmark({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="flex items-baseline gap-1.5 leading-none">
        <span className="font-display-tight text-[1.2rem] font-semibold text-fg">QuickBite</span>
        {compact ? null : (
          <span className="text-[0.8125rem] font-medium text-fg-subtle">Support</span>
        )}
      </span>
    </span>
  );
}
