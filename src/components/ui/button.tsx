import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";

import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap font-medium",
    "transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out",
    "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
    "active:translate-y-px disabled:pointer-events-none disabled:opacity-45",
    "[&_svg]:size-4 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary: "bg-brand text-on-brand shadow-1 hover:bg-brand-hover",
        secondary: "border border-line-strong bg-surface-2 text-fg shadow-1 hover:bg-surface-3",
        ghost: "text-fg-muted hover:bg-surface-3 hover:text-fg",
        subtle:
          "bg-brand-soft text-brand-ink hover:bg-[color-mix(in_oklab,var(--brand)_19%,transparent)]",
        danger:
          "bg-danger-soft text-danger hover:bg-[color-mix(in_oklab,var(--danger)_20%,transparent)]",
      },
      size: {
        sm: "h-8 rounded-sm px-3 text-[0.8125rem]",
        md: "h-10 rounded-md px-4 text-sm",
        lg: "h-12 rounded-md px-5 text-[0.9375rem]",
        icon: "size-9 rounded-sm",
        "icon-sm": "size-8 rounded-sm [&_svg]:size-[0.95rem]",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  loading = false,
  disabled,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}
