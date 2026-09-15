import { cn } from "@/lib/utils";

export interface MarqueeItem {
  id: string;
  label: string;
  meta?: string;
}

/**
 * Aceternity Infinite Moving Cards, rethemed and rebuilt without DOM cloning.
 *
 * The stock component `cloneNode`s its children after mount, which React does not know about and
 * which doubles every item for screen readers. This renders the list twice with the copy marked
 * aria-hidden, runs on a pure CSS animation (no client JS at all), pauses on hover and on keyboard
 * focus, and becomes a static horizontally-scrollable row under reduced motion. Cards become quiet
 * pills: a knowledge-base index should read as texture, not as testimonials.
 */
export function InfiniteMovingCards({
  items,
  label,
  speed = "slow",
  direction = "left",
  className,
}: {
  items: MarqueeItem[];
  label: string;
  speed?: "normal" | "slow";
  direction?: "left" | "right";
  className?: string;
}) {
  const style = {
    "--marquee-duration": speed === "slow" ? "140s" : "80s",
    "--marquee-gap": "0.625rem",
  } as React.CSSProperties;

  const renderList = (hidden: boolean) => (
    <ul
      aria-hidden={hidden || undefined}
      className={cn("flex shrink-0 gap-2.5", hidden && "motion-reduce:hidden")}
    >
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-center gap-2 whitespace-nowrap rounded-full border border-line bg-surface-1 py-1.5 pl-2.5 pr-3.5 text-[0.8125rem] text-fg-muted"
        >
          <span aria-hidden className="size-1.5 rounded-full bg-brand-line" />
          {item.label}
          {item.meta ? (
            <span className="font-mono text-2xs text-fg-subtle">{item.meta}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );

  return (
    <section
      aria-label={label}
      className={cn(
        "group relative overflow-hidden mask-fade-x motion-reduce:overflow-x-auto motion-reduce:[mask-image:none]",
        className,
      )}
      style={style}
    >
      <div
        className={cn(
          "flex w-max gap-2.5 py-1 motion-safe:animate-marquee",
          "group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused]",
          direction === "right" && "[animation-direction:reverse]",
        )}
      >
        {renderList(false)}
        {renderList(true)}
      </div>
    </section>
  );
}
