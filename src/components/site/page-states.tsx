import { CircleAlert, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  className,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-start gap-3 rounded-lg border border-[color-mix(in_oklab,var(--danger)_28%,transparent)] bg-danger-soft p-5",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
        <div>
          <p className="text-sm font-medium text-fg">{title}</p>
          <p className="mt-0.5 text-[0.8125rem] text-fg-muted">{message}</p>
        </div>
      </div>
      {onRetry ? (
        <Button size="sm" onClick={onRetry}>
          <RotateCcw aria-hidden />
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-dashed border-line-strong px-6 py-12 text-center",
        className,
      )}
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-surface-3 text-fg-subtle [&_svg]:size-5">
        {icon}
      </span>
      <div>
        <p className="font-medium text-fg">{title}</p>
        {description ? <p className="mt-1 text-[0.8125rem] text-fg-subtle">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
