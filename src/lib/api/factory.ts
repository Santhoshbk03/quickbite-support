/**
 * The one place that decides which ChatClient the app uses.
 *
 * Going live is `NEXT_PUBLIC_API_MODE=live` plus `NEXT_PUBLIC_API_URL`. No UI code changes.
 */
import type { ChatClient } from "./client";
import { readApiConfig } from "./config";
import type { ApiConfig } from "./config";
import { HttpChatClient } from "./http-client";
import { MockChatClient } from "./mock/mock-client";
import type { MockChatClientOptions } from "./mock/mock-client";

export interface CreateChatClientOptions {
  /** Defaults to the environment-derived config. */
  config?: ApiConfig;
  /** Mock-only overrides, e.g. from URL parameters. Ignored in live mode. */
  mock?: MockChatClientOptions;
  fetchImpl?: typeof fetch;
}

export function createChatClient(options: CreateChatClientOptions = {}): ChatClient {
  const config = options.config ?? readApiConfig();

  // config.apiUrl is guaranteed non-null in live mode: readApiConfig() downgrades a live mode with
  // no URL to mock and records configError, so a deploy typo degrades instead of white-screening.
  if (config.mode === "live" && config.apiUrl) {
    return new HttpChatClient({ baseUrl: config.apiUrl, fetchImpl: options.fetchImpl });
  }

  return new MockChatClient({ profile: config.mockProfile, ...options.mock });
}

let cachedConfig: ApiConfig | null = null;
let cachedClient: ChatClient | null = null;

/** Environment config, read once per process. */
export function getApiConfig(): ApiConfig {
  cachedConfig ??= readApiConfig();
  return cachedConfig;
}

/** Shared client instance for app code. */
export function getChatClient(): ChatClient {
  cachedClient ??= createChatClient({ config: getApiConfig() });
  return cachedClient;
}

/** Test and story hook: drop the memoised client and config. */
export function resetChatClient(): void {
  cachedClient = null;
  cachedConfig = null;
}
