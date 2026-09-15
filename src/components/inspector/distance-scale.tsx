import type { DistanceMetric } from "@/lib/api";
import { formatDistance } from "@/lib/format";
import { cn } from "@/lib/utils";

export type DistanceMarkState = "cited" | "passed" | "rejected";

export interface DistanceMark {
  id: string;
  distance: number;
  label: string;
  state: DistanceMarkState;
}

const STATE_LABEL: Record<DistanceMarkState, string> = {
  cited: "cited in the answer",
  passed: "cleared the threshold, not cited",
  rejected: "below the threshold",
};

const MARK_CLASS: Record<DistanceMarkState, string> = {
  cited: "z-20 border-brand bg-brand shadow-[0_0_0_3px_var(--surface-1)]",
  passed: "z-10 border-brand bg-surface-1",
  rejected: "border-fg-subtle bg-surface-3",
};

export function markState(chunk: {
  passed_threshold: boolean;
  used_in_answer: boolean;
}): DistanceMarkState {
  if (chunk.used_in_answer) return "cited";
  return chunk.passed_threshold ? "passed" : "rejected";
}

function scaleDomain(
  marks: DistanceMark[],
  threshold: number,
  metric: DistanceMetric,
): [number, number] {
  const distances = marks.map((mark) => mark.distance);
  const low = Math.min(0, ...distances);
  const high =
    metric === "cosine"
      ? Math.max(1, ...distances)
      : Math.max(threshold * 1.6, ...distances) * 1.05;
  return [low, high];
}

/**
 * Where each retrieved chunk landed relative to the refusal threshold. Lower is more similar, so the
 * saffron zone on the left is "close enough to answer from".
 */
export function DistanceScale({
  marks,
  threshold,
  metric,
  className,
  showAxis = true,
}: {
  marks: DistanceMark[];
  threshold: number;
  metric: DistanceMetric;
  className?: string;
  showAxis?: boolean;
}) {
  const [low, high] = scaleDomain(marks, threshold, metric);
  const toPercent = (value: number) =>
    Math.min(100, Math.max(0, ((value - low) / (high - low || 1)) * 100));
  const thresholdPercent = toPercent(threshold);

  const description = [
    `Distance scale for ${metric} distance; lower is more similar. Threshold ${formatDistance(threshold)}.`,
    ...marks.map(
      (mark) => `${mark.label}: ${formatDistance(mark.distance)}, ${STATE_LABEL[mark.state]}.`,
    ),
  ].join(" ");

  return (
    <figure className={cn("m-0", className)}>
      <div role="img" aria-label={description} className="relative h-9">
        <div className="absolute inset-x-0 top-[22px] h-1.5 rounded-full bg-surface-3" />
        <div
          className="absolute left-0 top-[22px] h-1.5 rounded-l-full bg-brand-soft"
          style={{ width: `${thresholdPercent}%` }}
        />
        <div
          className="absolute top-[14px] h-[22px] w-px bg-brand"
          style={{ left: `${thresholdPercent}%` }}
        />
        <span
          className="absolute top-0 -translate-x-1/2 whitespace-nowrap font-mono text-2xs tabular text-brand-ink"
          style={{ left: `clamp(1.75rem, ${thresholdPercent}%, calc(100% - 1.75rem))` }}
        >
          ≤ {formatDistance(threshold)}
        </span>
        {marks.map((mark) => (
          <span
            key={mark.id}
            aria-hidden
            className={cn(
              "absolute top-[25px] size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2",
              MARK_CLASS[mark.state],
            )}
            style={{ left: `${toPercent(mark.distance)}%` }}
          />
        ))}
      </div>
      {showAxis ? (
        <figcaption className="mt-1 flex items-center justify-between font-mono text-2xs tabular text-fg-subtle">
          <span>{low.toFixed(1)}</span>
          <span className="font-sans">closer · {metric} distance · further</span>
          <span>{high.toFixed(1)}</span>
        </figcaption>
      ) : null}
    </figure>
  );
}
