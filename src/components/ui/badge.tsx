import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border font-medium [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "border-line bg-surface-3 text-fg-muted",
        outline: "border-line-strong bg-transparent text-fg-muted",
        brand: "border-brand-line bg-brand-soft text-brand-ink",
        success:
          "border-[color-mix(in_oklab,var(--success)_32%,transparent)] bg-success-soft text-success",
        danger:
          "border-[color-mix(in_oklab,var(--danger)_32%,transparent)] bg-danger-soft text-danger",
        info: "border-[color-mix(in_oklab,var(--info)_30%,transparent)] bg-info-soft text-info",
      },
      size: {
        sm: "h-5 px-2 text-2xs",
        md: "h-6 px-2.5 text-xs",
      },
      mono: {
        true: "font-mono tabular tracking-tight",
        false: "",
      },
    },
    defaultVariants: { tone: "neutral", size: "md", mono: false },
  },
);

export interface BadgeProps
  extends React.ComponentProps<"span">, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, size, mono, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, size, mono }), className)} {...props} />;
}

export function StatusDot({
  tone = "neutral",
  pulse = false,
  className,
}: {
  tone?: "neutral" | "brand" | "success" | "danger";
  pulse?: boolean;
  className?: string;
}) {
  const color = {
    neutral: "bg-fg-subtle",
    brand: "bg-brand",
    success: "bg-success",
    danger: "bg-danger",
  }[tone];
  return (
    <span className={cn("relative inline-flex size-2 shrink-0", className)} aria-hidden>
      {pulse ? (
        <span
          className={cn("absolute inset-0 rounded-full opacity-60 motion-safe:animate-ping", color)}
        />
      ) : null}
      <span className={cn("relative inline-flex size-2 rounded-full", color)} />
    </span>
  );
}
