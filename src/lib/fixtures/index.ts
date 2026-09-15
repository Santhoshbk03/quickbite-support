export {
  CHUNKS_BY_ID,
  DOCUMENT_TITLES,
  KNOWLEDGE_CHUNKS,
  KNOWLEDGE_DOCUMENTS,
  POLICY_DOCUMENTS,
  estimateTokens,
  getChunk,
} from "./documents";
export type { FixtureChunk, FixtureDocument, KnowledgeChunk } from "./documents";

export {
  ORDERS,
  ORDERS_BY_ID,
  buildLookupOrderResult,
  findOrder,
  normalizeOrderId,
} from "./orders";
export type { FixtureOrder, OrderRecord } from "./orders";

export {
  CONVERSATIONS_BY_ID,
  SCRIPTED_CONVERSATIONS,
  matchScriptedTurn,
  normalizeQuestion,
  scriptedTurnContent,
} from "./conversations";
export type {
  Capability,
  ScriptedChunkRef,
  ScriptedConversation,
  ScriptedTimings,
  ScriptedToolCall,
  ScriptedTurn,
  ScriptedTurnMatch,
} from "./conversations";

export { EXAMPLE_QUESTIONS } from "./examples";
export type { ExampleQuestion } from "./examples";
