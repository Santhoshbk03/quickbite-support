/**
 * Pipeline defaults the mock reports, and the timing profiles it performs.
 *
 * Every value here is a placeholder for something the real backend owns — see
 * docs/API_CONTRACT.md §14 "Open decisions". They live in one place so swapping in the real
 * numbers is a single edit.
 */
import type { MockProfile } from "../config";

export const PIPELINE = {
  distanceMetric: "cosine" as const,
  /** A chunk qualifies iff distance <= threshold. */
  threshold: 0.55,
  topK: 3,
  embeddingModel: "all-MiniLM-L6-v2",
  embeddingDimensions: 384,
  collection: "quickbite_policies",
  temperature: 0.2,
  maxTokens: 700,
  systemPromptTokens: 320,
  primaryModel: { provider: "groq", name: "llama-3.3-70b-versatile" },
  fallbackModel: { provider: "ollama", name: "llama3.1:8b" },
  /** USD per million tokens. Groq list prices; Ollama is self-hosted, so zero. */
  pricing: {
    "llama-3.3-70b-versatile": { input: 0.59, output: 0.79 },
    "llama3.1:8b": { input: 0, output: 0 },
  } as Record<string, { input: number; output: number }>,
} as const;

export function estimateCostUsd(
  modelName: string,
  promptTokens: number,
  completionTokens: number,
): number | null {
  const price = PIPELINE.pricing[modelName];
  if (!price) return null;
  const usd =
    (promptTokens / 1_000_000) * price.input + (completionTokens / 1_000_000) * price.output;
  // Sub-cent values: keep enough precision to be meaningful rather than rounding to 0.00.
  return Math.round(usd * 1_000_000) / 1_000_000;
}

export type Range = readonly [number, number];

export interface TimingProfile {
  /** Extra delay before the first event on the client's first request, imitating a sleeping host. */
  coldStart: Range | null;
  /** Round trip before message.start. */
  rtt: Range;
  embedding: Range;
  retrieval: Range;
  filtering: Range;
  /** Retrieval finished until the first token. */
  ttft: Range;
  /** Generation speed for the primary (Groq) model. */
  tokensPerSecond: Range;
  /** Generation speed when the Ollama fallback serves the answer. */
  fallbackTokensPerSecond: Range;
  toolDuration: Range;
  /** Probability that a delta is preceded by a network stall. */
  stallChance: number;
  stallMultiplier: Range;
  /** Probability that a given response falls back from Groq to Ollama. */
  fallbackChance: number;
  healthLatency: Range;
  /**
   * Multiplier applied to every sleep. 0 runs the whole pipeline instantly while still *reporting*
   * realistic durations, which is what the contract check needs.
   */
  sleepScale: number;
}

const DEMO: TimingProfile = {
  coldStart: null,
  rtt: [60, 140],
  embedding: [22, 42],
  retrieval: [9, 26],
  filtering: [0.6, 2.4],
  ttft: [280, 520],
  tokensPerSecond: [95, 150],
  fallbackTokensPerSecond: [26, 46],
  toolDuration: [380, 900],
  stallChance: 0.05,
  stallMultiplier: [6, 18],
  fallbackChance: 0,
  healthLatency: [60, 180],
  sleepScale: 1,
};

export const TIMING_PROFILES: Record<MockProfile, TimingProfile> = {
  /** Tuned for someone watching for the first time: no cold start, streaming visible but brisk. */
  demo: DEMO,
  /** What a real deployment feels like, including a sleeping backend and occasional fallback. */
  realistic: {
    ...DEMO,
    coldStart: [3200, 5600],
    rtt: [80, 220],
    embedding: [26, 64],
    retrieval: [12, 38],
    filtering: [0.8, 3.2],
    ttft: [320, 780],
    tokensPerSecond: [180, 300],
    toolDuration: [420, 1200],
    stallChance: 0.09,
    stallMultiplier: [8, 26],
    fallbackChance: 0.08,
    healthLatency: [120, 420],
    sleepScale: 1,
  },
  /** Same reported numbers, zero wall time. For tests and the contract check. */
  instant: { ...DEMO, sleepScale: 0 },
};

export function sleepFor(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(new DOMException("The operation was aborted.", "AbortError"));
    }
    if (signal) {
      if (signal.aborted) {
        clearTimeout(timer);
        reject(new DOMException("The operation was aborted.", "AbortError"));
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}
