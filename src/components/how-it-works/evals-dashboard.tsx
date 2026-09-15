import { ArrowRight, FlaskConical, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { EVALS, getRun } from "@/lib/evals";
import type { EvalMetricId, EvalRun } from "@/lib/evals";
import { cn } from "@/lib/utils";

function delta(from: number, to: number) {
  const change = to - from;
  return {
    change,
    label: `${change >= 0 ? "+" : "−"}${Math.abs(change).toFixed(2)}`,
    relative:
      from > 0 ? `${change >= 0 ? "+" : "−"}${Math.abs((change / from) * 100).toFixed(1)}%` : "",
    tone:
      Math.abs(change) < 0.005
        ? ("neutral" as const)
        : change > 0
          ? ("success" as const)
          : ("danger" as const),
  };
}

export function EvalsDashboard() {
  const baseline = getRun(EVALS.baseline_run_id);
  const current = getRun(EVALS.current_run_id);
  const headline = EVALS.headline;

  return (
    <div className="flex flex-col gap-6">
      {EVALS.is_placeholder ? (
        <div
          role="note"
          className="flex items-start gap-3 rounded-md border border-brand-line bg-brand-soft px-4 py-3"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-brand-ink" aria-hidden />
          <p className="text-[0.8125rem] leading-relaxed text-fg-muted">
            <span className="font-medium text-fg">Placeholder numbers.</span> Only the top-k 5 → 3
            context precision change (0.54 → 0.64) is a measured result. Replace{" "}
            <code className="font-mono text-2xs text-fg">src/data/evals.json</code> with real runs
            and this notice disappears.
          </p>
        </div>
      ) : null}

      {headline ? (
        <HeadlineCard
          metric={headline.metric}
          baseline={baseline}
          current={current}
          summary={headline.summary}
          tradeoff={headline.tradeoff}
        />
      ) : null}

      <section aria-labelledby="metrics-title">
        <div className="mb-3 flex items-end justify-between gap-3">
          <h3 id="metrics-title" className="font-display-tight text-lg font-medium text-fg">
            All metrics
          </h3>
          <p className="text-2xs text-fg-subtle">
            {baseline.label} (top-k {baseline.config.top_k}) → {current.label} (top-k{" "}
            {current.config.top_k})
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {EVALS.metrics.map((metric) => {
            const from = baseline.scores[metric.id];
            const to = current.scores[metric.id];
            if (from === undefined || to === undefined) return null;
            const change = delta(from, to);
            return (
              <article
                key={metric.id}
                className="rounded-lg border border-line bg-surface-2 p-4 shadow-1"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="text-[0.8125rem] font-medium text-fg">{metric.label}</h4>
                    <p className="mt-0.5 text-2xs leading-relaxed text-fg-subtle">
                      {metric.description}
                    </p>
                  </div>
                  <Badge tone={change.tone} size="sm" mono>
                    {change.label}
                  </Badge>
                </div>
                <p className="mt-3 font-display-tight text-[2rem] font-medium leading-none tabular text-fg">
                  {to.toFixed(2)}
                </p>
                <div className="mt-3 flex flex-col gap-1.5">
                  <ScoreBar label={baseline.label} value={from} tone="baseline" />
                  <ScoreBar label={current.label} value={to} tone="current" />
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {EVALS.refusals ? (
        <section
          aria-labelledby="refusals-title"
          className="rounded-lg border border-line bg-surface-2 p-4 shadow-1"
        >
          <h3 id="refusals-title" className="text-[0.8125rem] font-medium text-fg">
            Refusal behaviour
          </h3>
          <dl className="mt-3 grid grid-cols-3 gap-3">
            <Figure label="Out-of-scope questions" value={EVALS.refusals.out_of_scope_questions} />
            <Figure
              label="Correctly refused"
              value={`${EVALS.refusals.correctly_refused}/${EVALS.refusals.out_of_scope_questions}`}
            />
            <Figure
              label="False refusals (in scope)"
              value={EVALS.refusals.in_scope_false_refusals}
            />
          </dl>
        </section>
      ) : null}

      <section aria-labelledby="runs-title">
        <h3 id="runs-title" className="mb-2 text-[0.8125rem] font-medium text-fg">
          Runs
        </h3>
        <div className="scrollbar-thin overflow-x-auto rounded-md border border-line">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-3 text-fg-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Run</th>
                <th className="px-3 py-2 font-medium">top-k</th>
                <th className="px-3 py-2 font-medium">Threshold</th>
                {EVALS.metrics.map((metric) => (
                  <th key={metric.id} className="whitespace-nowrap px-3 py-2 font-medium">
                    {metric.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {EVALS.runs.map((run) => (
                <tr key={run.id} className="border-t border-line">
                  <td className="whitespace-nowrap px-3 py-2 text-fg">
                    {run.label}
                    {run.id === EVALS.current_run_id ? (
                      <Badge tone="brand" size="sm" className="ml-2">
                        current
                      </Badge>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 font-mono tabular text-fg-muted">{run.config.top_k}</td>
                  <td className="px-3 py-2 font-mono tabular text-fg-muted">
                    {run.config.distance_threshold ?? "—"}
                  </td>
                  {EVALS.metrics.map((metric) => (
                    <td key={metric.id} className="px-3 py-2 font-mono tabular text-fg-muted">
                      {run.scores[metric.id]?.toFixed(2) ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="flex items-center gap-1.5 text-2xs text-fg-subtle">
        <FlaskConical className="size-3.5" aria-hidden />
        {EVALS.dataset.name} · {EVALS.dataset.size} questions · {EVALS.framework} ·{" "}
        {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
          new Date(EVALS.generated_at),
        )}
      </p>
    </div>
  );
}

function HeadlineCard({
  metric,
  baseline,
  current,
  summary,
  tradeoff,
}: {
  metric: EvalMetricId;
  baseline: EvalRun;
  current: EvalRun;
  summary: string;
  tradeoff?: string | null;
}) {
  const from = baseline.scores[metric];
  const to = current.scores[metric];
  if (from === undefined || to === undefined) return null;
  const change = delta(from, to);
  const label = EVALS.metrics.find((candidate) => candidate.id === metric)?.label ?? metric;

  return (
    <section
      aria-labelledby="headline-title"
      className="overflow-hidden rounded-xl border border-brand-line bg-surface-2 shadow-2"
    >
      <div className="px-5 pb-5 pt-5 sm:px-6">
        <p className="eyebrow !text-brand-ink">The change that mattered</p>
        <h3 id="headline-title" className="mt-1 font-display-tight text-xl font-medium text-fg">
          {label}: top-k {baseline.config.top_k} → {current.config.top_k}
        </h3>
        <p className="mt-1.5 text-sm text-fg-muted">{summary}</p>

        <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
          <div>
            <p className="text-2xs text-fg-subtle">Before · top-k {baseline.config.top_k}</p>
            <p className="mt-1 font-display-tight text-[2.5rem] font-medium leading-none tabular text-fg-muted">
              {from.toFixed(2)}
            </p>
          </div>
          <ArrowRight className="size-5 text-brand-ink" aria-hidden />
          <div>
            <p className="text-2xs text-fg-subtle">After · top-k {current.config.top_k}</p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="font-display-tight text-[2.5rem] font-medium leading-none tabular text-fg">
                {to.toFixed(2)}
              </span>
              <Badge tone={change.tone} mono>
                {change.label} ({change.relative})
              </Badge>
            </p>
          </div>
        </div>

        <div
          className="relative mt-5 h-3 rounded-full bg-surface-3"
          role="img"
          aria-label={`${label} rose from ${from.toFixed(2)} to ${to.toFixed(2)}`}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-brand"
            style={{ width: `${to * 100}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 rounded-full border-r-2 border-canvas bg-fg-subtle/60"
            style={{ width: `${from * 100}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between font-mono text-2xs tabular text-fg-subtle">
          <span>0.00</span>
          <span>1.00</span>
        </div>
      </div>
      {tradeoff ? (
        <p className="border-t border-line bg-sunken px-5 py-3 text-xs leading-relaxed text-fg-muted sm:px-6">
          <span className="font-medium text-fg">Trade-off: </span>
          {tradeoff}
        </p>
      ) : null}
    </section>
  );
}

function ScoreBar({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "baseline" | "current";
}) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_2.5rem] items-center gap-2">
      <span className="truncate text-2xs text-fg-subtle">{label}</span>
      <span className="h-1.5 rounded-full bg-surface-3">
        <span
          className={cn(
            "block h-full rounded-full",
            tone === "current" ? "bg-brand" : "bg-fg-subtle/50",
          )}
          style={{ width: `${value * 100}%` }}
        />
      </span>
      <span className="text-right font-mono text-2xs tabular text-fg-muted">
        {value.toFixed(2)}
      </span>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-2xs leading-snug text-fg-subtle">{label}</dt>
      <dd className="mt-1 font-display-tight text-2xl font-medium tabular text-fg">{value}</dd>
    </div>
  );
}
