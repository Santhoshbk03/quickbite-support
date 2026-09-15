/**
 * Eval results schema. Drop real numbers into src/data/evals.json; the build fails loudly if the
 * file drifts from this shape, and the dashboard hides any optional block that is missing.
 */
import { z } from "zod";

import rawEvals from "@/data/evals.json";

const Score = z.number().min(0).max(1);

export const EvalMetricIdSchema = z.enum([
  "faithfulness",
  "answer_relevancy",
  "context_precision",
  "context_recall",
]);

export const EvalsFileSchema = z
  .object({
    schema_version: z.literal(1),
    /** When true, the dashboard labels every number as placeholder data. */
    is_placeholder: z.boolean(),
    generated_at: z.iso.datetime({ offset: true }),
    framework: z.string().min(1),
    dataset: z.object({
      name: z.string().min(1),
      size: z.number().int().min(1),
      description: z.string().nullish(),
    }),
    metrics: z
      .array(
        z.object({
          id: EvalMetricIdSchema,
          label: z.string().min(1),
          description: z.string().min(1),
        }),
      )
      .min(1),
    runs: z
      .array(
        z.object({
          id: z.string().min(1),
          label: z.string().min(1),
          config: z.object({
            top_k: z.number().int().min(1),
            distance_threshold: z.number().nullish(),
          }),
          scores: z.record(EvalMetricIdSchema, Score),
        }),
      )
      .min(1),
    baseline_run_id: z.string().min(1),
    current_run_id: z.string().min(1),
    headline: z
      .object({
        metric: EvalMetricIdSchema,
        summary: z.string().min(1),
        tradeoff: z.string().nullish(),
      })
      .nullish(),
    refusals: z
      .object({
        out_of_scope_questions: z.number().int().min(0),
        correctly_refused: z.number().int().min(0),
        in_scope_false_refusals: z.number().int().min(0),
      })
      .nullish(),
  })
  .refine(
    (file) =>
      file.runs.some((run) => run.id === file.baseline_run_id) &&
      file.runs.some((run) => run.id === file.current_run_id),
    { message: "baseline_run_id and current_run_id must reference runs in the file" },
  );

export type EvalsFile = z.infer<typeof EvalsFileSchema>;
export type EvalMetricId = z.infer<typeof EvalMetricIdSchema>;
export type EvalRun = EvalsFile["runs"][number];

/** Parsed once at module load. A malformed file is a build-time error, not a blank dashboard. */
export const EVALS: EvalsFile = EvalsFileSchema.parse(rawEvals);

export function getRun(id: string): EvalRun {
  const run = EVALS.runs.find((candidate) => candidate.id === id);
  if (!run) throw new Error(`Unknown eval run ${id}`);
  return run;
}
