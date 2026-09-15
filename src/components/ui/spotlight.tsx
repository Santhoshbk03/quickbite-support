import { cn } from "@/lib/utils";

/**
 * Aceternity Spotlight, rethemed.
 *
 * Changes from the stock component: brand-tinted instead of white, a fraction of the opacity, and
 * the 151px SVG gaussian blur replaced by a radial gradient. The blur filter was the expensive part
 * (it rasterises a 3787×2842 surface); a gradient gives the same soft falloff for free. It plays
 * once on entry and never loops.
 */
export function Spotlight({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={cn(
        "pointer-events-none absolute z-0 h-[169%] w-[138%] opacity-0 motion-safe:animate-spotlight motion-reduce:opacity-100 lg:w-[84%]",
        className,
      )}
      viewBox="0 0 3787 2842"
      fill="none"
    >
      <defs>
        <radialGradient id="qb-spotlight-fill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.16" />
          <stop offset="55%" stopColor="var(--brand)" stopOpacity="0.05" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse
        cx="1924.71"
        cy="273.501"
        rx="1924.71"
        ry="273.501"
        transform="matrix(-0.822377 -0.568943 -0.568943 0.822377 3631.88 2291.09)"
        fill="url(#qb-spotlight-fill)"
      />
    </svg>
  );
}
