/**
 * Seeded PRNG. Determinism matters twice: the contract check needs reproducible runs, and a given
 * question should pace and jitter the same way twice in a demo.
 */
export interface Random {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max], inclusive. */
  int(min: number, max: number): number;
  float(min: number, max: number): number;
  /** Uniform float from a [min, max] tuple. */
  range(range: readonly [number, number]): number;
  pick<T>(items: readonly T[]): T;
  chance(probability: number): boolean;
  /** Pick by relative weight: [[value, weight], ...]. */
  weighted<T>(entries: readonly (readonly [T, number])[]): T;
  /** A 32-character lowercase hex id, shaped like an OpenTelemetry trace id. */
  hex(length?: number): string;
}

export function createRandom(seed: number): Random {
  let state = (seed | 0) === 0 ? 0x9e3779b9 : seed | 0;

  const next = (): number => {
    // mulberry32
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const random: Random = {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    float: (min, max) => min + next() * (max - min),
    range: ([min, max]) => min + next() * (max - min),
    pick: (items) => {
      if (items.length === 0) throw new Error("pick() needs a non-empty array");
      return items[Math.floor(next() * items.length)];
    },
    chance: (probability) => next() < probability,
    weighted: (entries) => {
      if (entries.length === 0) throw new Error("weighted() needs at least one entry");
      const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
      let target = next() * total;
      for (const [value, weight] of entries) {
        target -= weight;
        if (target <= 0) return value;
      }
      return entries[entries.length - 1][0];
    },
    hex: (length = 32) => {
      let out = "";
      while (out.length < length) {
        out += Math.floor(next() * 0x100000000)
          .toString(16)
          .padStart(8, "0");
      }
      return out.slice(0, length);
    },
  };

  return random;
}

/** Stable 32-bit hash, so the same question seeds the same stream. */
export function hashSeed(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash | 0;
}
