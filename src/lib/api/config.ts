/**
 * Environment-driven configuration. The only place env vars are read.
 *
 * NEXT_PUBLIC_* values are inlined at build time, so they must be referenced as full static
 * property accesses (`process.env.NEXT_PUBLIC_API_MODE`) — never destructured or index-accessed,
 * or Next cannot substitute them.
 */
import { z } from "zod";

import type { ClientMode } from "./client";

export type MockProfile = "demo" | "realistic" | "instant";

export interface ApiConfig {
  mode: ClientMode;
  /** Base URL for live mode; may include a path prefix. Null in mock mode. */
  apiUrl: string | null;
  mockProfile: MockProfile;
  /** e.g. https://cloud.langfuse.com/project/abc123 — used to build trace links if the backend sends only trace_id. */
  langfuseProjectUrl: string | null;
  /** Set when the requested configuration was unusable and we fell back to mock. Surfaced in the UI, never thrown. */
  configError: string | null;
}

/** Treat empty strings as unset: a declared-but-blank Vercel env var is the common case. */
const optionalString = z
  .string()
  .trim()
  .transform((value) => (value === "" ? undefined : value))
  .optional();

const EnvSchema = z.object({
  mode: z.enum(["mock", "live"]).default("mock"),
  apiUrl: optionalString.pipe(z.url({ protocol: /^https?$/ }).optional()),
  mockProfile: z.enum(["demo", "realistic", "instant"]).default("demo"),
  langfuseProjectUrl: optionalString.pipe(z.url({ protocol: /^https?$/ }).optional()),
});

export function readApiConfig(): ApiConfig {
  const parsed = EnvSchema.safeParse({
    mode: emptyToUndefined(process.env.NEXT_PUBLIC_API_MODE),
    apiUrl: process.env.NEXT_PUBLIC_API_URL,
    mockProfile: emptyToUndefined(process.env.NEXT_PUBLIC_MOCK_PROFILE),
    langfuseProjectUrl: process.env.NEXT_PUBLIC_LANGFUSE_PROJECT_URL,
  });

  if (!parsed.success) {
    return {
      mode: "mock",
      apiUrl: null,
      mockProfile: "demo",
      langfuseProjectUrl: null,
      configError: `Invalid API configuration, using mock mode. ${parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    };
  }

  const env = parsed.data;

  // Live mode without a URL is a deploy misconfiguration. Degrade to mock instead of white-screening.
  if (env.mode === "live" && !env.apiUrl) {
    return {
      mode: "mock",
      apiUrl: null,
      mockProfile: env.mockProfile,
      langfuseProjectUrl: env.langfuseProjectUrl ?? null,
      configError:
        "NEXT_PUBLIC_API_MODE=live requires NEXT_PUBLIC_API_URL. Falling back to mock mode.",
    };
  }

  return {
    mode: env.mode,
    apiUrl: env.apiUrl ? stripTrailingSlash(env.apiUrl) : null,
    mockProfile: env.mockProfile,
    langfuseProjectUrl: env.langfuseProjectUrl ? stripTrailingSlash(env.langfuseProjectUrl) : null,
    configError: null,
  };
}

function emptyToUndefined(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function stripTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.replace(/\/+$/, "") : value;
}

/** Join a base URL that may carry a path prefix with a contract path. */
export function joinUrl(baseUrl: string, path: string): string {
  const base = stripTrailingSlash(baseUrl);
  return path.startsWith("/") ? `${base}${path}` : `${base}/${path}`;
}

export function buildTraceUrl(
  traceId: string | null | undefined,
  traceUrl: string | null | undefined,
  langfuseProjectUrl: string | null,
): string | null {
  if (traceUrl) return traceUrl;
  if (traceId && langfuseProjectUrl) return `${langfuseProjectUrl}/traces/${traceId}`;
  return null;
}
