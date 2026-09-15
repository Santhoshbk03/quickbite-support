import { cn } from "@/lib/utils";

/**
 * Aceternity Bento Grid, rethemed: token surfaces and hairlines instead of white/black, the display
 * face for titles, and the hover nudge kept but limited to pointer devices.
 */
export function BentoGrid({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 md:auto-rows-[minmax(11rem,auto)] md:grid-cols-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function BentoGridItem({
  className,
  title,
  description,
  header,
  icon,
}: {
  className?: string;
  title: React.ReactNode;
  description: React.ReactNode;
  header?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "group/bento relative flex flex-col justify-between gap-4 overflow-hidden rounded-lg border border-line bg-surface-1 p-4 shadow-1 transition-[border-color,box-shadow] duration-200 hover:border-line-strong hover:shadow-2",
        className,
      )}
    >
      {header}
      <div className="transition-transform duration-200 ease-out [@media(hover:hover)]:group-hover/bento:translate-x-1">
        {icon ? <div className="mb-2.5 text-brand-ink [&_svg]:size-4">{icon}</div> : null}
        <h3 className="font-display-tight text-[1.0625rem] font-medium text-fg">{title}</h3>
        <p className="mt-1 text-[0.8125rem] leading-relaxed text-fg-subtle">{description}</p>
      </div>
    </div>
  );
}
