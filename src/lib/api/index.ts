/**
 * Public surface of the API layer. UI code imports from `@/lib/api` and nothing deeper.
 */
export * from "./schemas";

export {
  ApiError,
  contractWarn,
  isAbortError,
  isRetryableCode,
  makeErrorBody,
  makeErrorEvent,
} from "./client";
export type { ChatClient, ClientMode, RequestOptions } from "./client";

export { buildTraceUrl, joinUrl, readApiConfig } from "./config";
export type { ApiConfig, MockProfile } from "./config";

export { createChatClient, getApiConfig, getChatClient, resetChatClient } from "./factory";
export type { CreateChatClientOptions } from "./factory";

export { checkEventSequence, formatConformanceIssues } from "./conformance";
export type { ConformanceIssue } from "./conformance";

export { HttpChatClient } from "./http-client";
export type { HttpChatClientOptions } from "./http-client";

export { decodeSseStream } from "./sse";
export type { SseFrame } from "./sse";

export { MockChatClient, parseMockOptionsFromSearch, PIPELINE } from "./mock";
export type { MockChatClientOptions, MockFailureMode } from "./mock";
