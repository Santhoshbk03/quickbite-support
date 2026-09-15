export type ApiMode = "mock" | "live";

/*
 * NEXT_PUBLIC_* variables are inlined at build time, and only when read by their literal name, so
 * they are read here exactly once rather than through a dynamic lookup.
 */
const rawMode = process.env.NEXT_PUBLIC_API_MODE;
const rawUrl = process.env.NEXT_PUBLIC_API_URL;

/** Backend base URL without a trailing slash. May include a path prefix such as `/v1`. */
export const API_URL: string | null = rawUrl?.trim().replace(/\/+$/, "") || null;

/** Live mode needs a URL; without one the app stays on demo data rather than failing. */
export const API_MODE: ApiMode = rawMode?.trim() === "live" && API_URL ? "live" : "mock";
