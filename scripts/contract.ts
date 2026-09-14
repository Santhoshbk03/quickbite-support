/**
 * Contract tooling. Zero dependencies, run through Node's type stripping.
 *
 *   pnpm contract:export            Write JSON Schemas to docs/contract/ (seed Pydantic models from these)
 *   pnpm contract:check             Run the scenario suite through the mock and validate everything
 *   pnpm contract:verify            Same suite over a real HTTP/SSE wire, then diff against the mock
 *   pnpm contract:serve [port]      Reference SSE server implementing the contract
 *   pnpm contract:check --url URL   Validate a real backend and report which optional fields it sends
 *
 * The point of `verify` is to prove the seam: identical events out of MockChatClient and out of
 * HttpChatClient once they have been through SSE framing, a socket, and Zod validation.
 */
import http from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

import {
  AssistantMessageSchema,
  ChatRequestSchema,
  ChatStreamEventSchema,
  CONTRACT_VERSION,
  DocumentsResponseSchema,
  ErrorEnvelopeSchema,
  FeedbackRequestSchema,
  HealthResponseSchema,
  parseStreamEvent,
} from "@/lib/api/schemas";
import type { ChatRequest, ChatStreamEvent, HistoryMessage } from "@/lib/api/schemas";
import { checkEventSequence } from "@/lib/api/conformance";
import type { ConformanceIssue } from "@/lib/api/conformance";
import { HttpChatClient } from "@/lib/api/http-client";
import { MockChatClient } from "@/lib/api/mock/mock-client";
import type { MockFailureMode } from "@/lib/api/mock/mock-client";
import { createRandom, tokenizeForStreaming } from "@/lib/api/mock";
import { SCRIPTED_CONVERSATIONS, scriptedTurnContent } from "@/lib/fixtures";
import type { ChatClient } from "@/lib/api/client";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "..");
const FIXED_NOW = new Date("2026-09-14T14:12:07.512Z");
const SEED = 987654321;

/* -----------------------------------------------------------------------------------------------
 * Scenarios
 * ---------------------------------------------------------------------------------------------*/

type Expectation = "answer" | "refusal" | "tool_call" | "tool_error" | "no_retrieval";

interface Scenario {
  name: string;
  question: string;
  history: HistoryMessage[];
  expect: Expectation[];
}

function buildScenarios(): Scenario[] {
  const scenarios: Scenario[] = [];

  // Every scripted turn, with the history its follow-ups depend on.
  for (const conversation of SCRIPTED_CONVERSATIONS) {
    const history: HistoryMessage[] = [];
    conversation.turns.forEach((turn, index) => {
      const expect: Expectation[] = [];
      if (turn.refusal) expect.push("refusal");
      else expect.push("answer");
      if (turn.tool_call) expect.push("tool_call");

      scenarios.push({
        name: `scripted/${conversation.id}#${index}`,
        question: turn.user,
        history: [...history],
        expect,
      });

      history.push({ role: "user", content: turn.user });
      history.push({
        role: "assistant",
        content: scriptedTurnContent(turn),
        tool_calls: turn.tool_call
          ? [
              {
                name: "lookup_order",
                arguments: { order_id: turn.tool_call.order_id },
                result: { order_id: turn.tool_call.order_id },
              },
            ]
          : null,
      });
    });
  }

  // Improvised: nothing below is scripted, so these exercise the retriever and composer.
  const improvised: Scenario[] = [
    {
      name: "improvised/in-scope cancellation",
      question: "Can I cancel an order after the restaurant has started cooking?",
      history: [],
      expect: ["answer"],
    },
    {
      name: "improvised/in-scope allergens",
      question: "Does the menu tell me if a dish contains nuts?",
      history: [],
      expect: ["answer"],
    },
    {
      name: "improvised/in-scope payment failure",
      question: "My payment failed but the money was debited. What happens now?",
      history: [],
      expect: ["answer"],
    },
    {
      name: "improvised/in-scope wallet expiry",
      question: "When do my QuickBite Wallet credits expire?",
      history: [],
      expect: ["answer"],
    },
    {
      name: "improvised/out-of-scope geography",
      question: "What is the capital of France?",
      history: [],
      expect: ["refusal"],
    },
    {
      name: "improvised/out-of-scope creative",
      question: "Write me a poem about pizza.",
      history: [],
      expect: ["refusal"],
    },
    {
      name: "improvised/out-of-scope adjacent",
      question: "What do QuickBite riders get paid per hour?",
      history: [],
      expect: ["refusal"],
    },
    {
      name: "improvised/small talk",
      question: "hi",
      history: [],
      expect: ["answer", "no_retrieval"],
    },
    {
      name: "improvised/order lookup",
      question: "Can you check on QB-50342?",
      history: [],
      expect: ["answer", "tool_call"],
    },
    {
      name: "improvised/unknown order",
      question: "Where is my order QB-00000?",
      history: [],
      expect: ["answer", "tool_error"],
    },
    {
      name: "improvised/status without id",
      question: "Where is my order?",
      history: [],
      expect: ["answer"],
    },
    {
      name: "improvised/contextual follow-up",
      question: "Is it going to be late?",
      history: [
        { role: "user", content: "Can you check on QB-48213?" },
        {
          role: "assistant",
          content: "Your order is on the way.",
          tool_calls: [
            {
              name: "lookup_order",
              arguments: { order_id: "QB-48213" },
              result: { order_id: "QB-48213" },
            },
          ],
        },
      ],
      expect: ["answer", "tool_call"],
    },
  ];

  return [...scenarios, ...improvised];
}

function toRequest(scenario: Scenario, index: number): ChatRequest {
  return {
    conversation_id: `conv_check_${index}`,
    message: { id: `msg_u_${index}`, content: scenario.question },
    history: scenario.history,
    options: null,
  };
}

/* -----------------------------------------------------------------------------------------------
 * Validation
 * ---------------------------------------------------------------------------------------------*/

interface Failure {
  scenario: string;
  problems: string[];
}

async function collect(client: ChatClient, request: ChatRequest): Promise<ChatStreamEvent[]> {
  const events: ChatStreamEvent[] = [];
  for await (const event of client.streamChat(request)) {
    events.push(event);
  }
  return events;
}

function validateScenario(scenario: Scenario, events: ChatStreamEvent[]): string[] {
  const problems: string[] = [];

  // 1. Every event must satisfy its schema.
  events.forEach((event, index) => {
    const parsed = parseStreamEvent(event);
    if (parsed.kind === "invalid") {
      problems.push(`event #${index} (${parsed.type}) failed schema validation: ${parsed.issues}`);
    } else if (parsed.kind === "unknown") {
      problems.push(`event #${index} has unknown type "${parsed.type}"`);
    }
  });

  // 2. The sequence must satisfy the grammar.
  const issues: ConformanceIssue[] = checkEventSequence(events);
  for (const issue of issues.filter((candidate) => candidate.severity === "error")) {
    problems.push(`grammar [${issue.code}] ${issue.message}`);
  }

  const end = events.find((event) => event.type === "message.end");
  const errorEvent = events.find((event) => event.type === "error");
  if (!end) {
    problems.push(
      errorEvent ? `terminated with error: ${errorEvent.error.code}` : "no message.end event",
    );
    return problems;
  }

  const message = end.message;
  const streamed = events
    .filter((event) => event.type === "message.delta")
    .map((event) => event.delta)
    .join("");
  if (streamed !== message.content) {
    problems.push("concatenated deltas do not equal message.end content");
  }

  // 3. Scenario expectations.
  const hasRefusal = message.refusal !== null;
  const toolCalls = message.tool_calls;
  if (scenario.expect.includes("refusal") && !hasRefusal) {
    const closest = message.retrieval?.chunks[0];
    problems.push(
      `expected a refusal; got an answer (closest distance ${closest?.distance ?? "n/a"} against threshold ${message.retrieval?.threshold ?? "n/a"})`,
    );
  }
  if (scenario.expect.includes("answer") && hasRefusal) {
    problems.push(
      `expected an answer; got a refusal (closest distance ${message.refusal?.reason === "below_threshold" ? message.refusal.closest_match?.distance : "n/a"})`,
    );
  }
  if (scenario.expect.includes("tool_call") && toolCalls.length === 0) {
    problems.push("expected a lookup_order tool call; none happened");
  }
  if (
    scenario.expect.includes("tool_error") &&
    !toolCalls.some((call) => call.status === "error")
  ) {
    problems.push("expected a failing tool call");
  }
  if (scenario.expect.includes("no_retrieval") && message.retrieval !== null) {
    problems.push("expected retrieval to be skipped");
  }

  // 4. Refusal invariants that matter to the UI.
  if (hasRefusal && message.refusal?.reason === "below_threshold") {
    if (message.finish_reason !== "refusal") problems.push("refusal without finish_reason=refusal");
    if (message.refusal.closest_match === null && (message.retrieval?.chunks.length ?? 0) > 0) {
      problems.push("refusal did not carry the closest non-qualifying match");
    }
    if (message.metadata?.usage != null) {
      problems.push("a below-threshold refusal should not report token usage");
    }
  }

  // 5. Metadata the inspector depends on.
  const latency = message.metadata?.latency_ms;
  if (latency && latency.total <= 0) problems.push("latency_ms.total must be positive");
  if (message.metadata?.trace_url != null) {
    problems.push("the mock must not emit a trace_url pointing at a trace that does not exist");
  }

  return problems;
}

/* -----------------------------------------------------------------------------------------------
 * Optional-field coverage (the INTEGRATION.md checklist, mechanised)
 * ---------------------------------------------------------------------------------------------*/

const COVERAGE_FIELDS = [
  "status events",
  "citation events",
  "retrieval.standalone_query",
  "retrieval.embedding_model",
  "chunk.document.section",
  "tool_call.content_offset",
  "tool_call.duration_ms",
  "metadata.trace_id",
  "metadata.trace_url",
  "metadata.model",
  "metadata.params",
  "metadata.usage",
  "metadata.estimated_cost_usd",
  "metadata.latency_ms",
  "metadata.spans",
  "refusal.suggestions",
] as const;

function updateCoverage(events: ChatStreamEvent[], seen: Set<string>): void {
  for (const event of events) {
    if (event.type === "status") seen.add("status events");
    if (event.type === "citation") seen.add("citation events");
    if (event.type === "retrieval") {
      if (event.retrieval.standalone_query) seen.add("retrieval.standalone_query");
      if (event.retrieval.embedding_model) seen.add("retrieval.embedding_model");
      if (event.retrieval.chunks.some((chunk) => chunk.document.section)) {
        seen.add("chunk.document.section");
      }
    }
    if (event.type === "tool_call.result") {
      if (event.tool_call.content_offset != null) seen.add("tool_call.content_offset");
      if (event.tool_call.duration_ms != null) seen.add("tool_call.duration_ms");
    }
    if (event.type === "refusal" && event.refusal.suggestions?.length) {
      seen.add("refusal.suggestions");
    }
    if (event.type === "message.end") {
      const metadata = event.message.metadata;
      if (!metadata) continue;
      if (metadata.trace_id) seen.add("metadata.trace_id");
      if (metadata.trace_url) seen.add("metadata.trace_url");
      if (metadata.model) seen.add("metadata.model");
      if (metadata.params) seen.add("metadata.params");
      if (metadata.usage) seen.add("metadata.usage");
      if (metadata.estimated_cost_usd != null) seen.add("metadata.estimated_cost_usd");
      if (metadata.latency_ms) seen.add("metadata.latency_ms");
      if (metadata.spans?.length) seen.add("metadata.spans");
    }
  }
}

function printCoverage(seen: Set<string>): void {
  console.log("\nOptional field coverage");
  for (const field of COVERAGE_FIELDS) {
    console.log(`  ${seen.has(field) ? "[x]" : "[ ]"} ${field}`);
  }
}

/* -----------------------------------------------------------------------------------------------
 * Fixture and helper invariants
 * ---------------------------------------------------------------------------------------------*/

function checkFixtures(): string[] {
  const problems: string[] = [];

  for (const conversation of SCRIPTED_CONVERSATIONS) {
    conversation.turns.forEach((turn, index) => {
      const label = `${conversation.id}#${index}`;
      const distances = turn.chunks.map((chunk) => chunk.distance);
      for (let i = 1; i < distances.length; i += 1) {
        if (distances[i] < distances[i - 1]) {
          problems.push(`${label}: chunk distances must ascend by rank (${distances.join(", ")})`);
          break;
        }
      }

      const content = scriptedTurnContent(turn);
      const cited = new Set<number>();
      for (const match of content.matchAll(/\[(\d{1,2})\]/g)) cited.add(Number(match[1]));
      for (const rank of cited) {
        const chunk = turn.chunks[rank - 1];
        if (!chunk) {
          problems.push(
            `${label}: content cites [${rank}] but only ${turn.chunks.length} chunks were retrieved`,
          );
        }
      }
      if (turn.refusal && cited.size > 0) {
        problems.push(`${label}: a refusal must not cite chunks`);
      }
    });
  }

  // The streaming tokeniser must be lossless, or the streamed text would drift from the final text.
  const rng = createRandom(42);
  const samples = [
    "Plain sentence.",
    "**Bold** and a list:\n\n- one [1]\n- two [2]\n\nDone.",
    "| a | b |\n| --- | --- |\n| 1 | 2 |",
    "Trailing spaces   \nand a tab\tinside.",
    "₹130 · 50% · em—dash",
  ];
  for (const sample of samples) {
    const rebuilt = tokenizeForStreaming(sample, rng).join("");
    if (rebuilt !== sample) {
      problems.push(`tokeniser lost data for sample ${JSON.stringify(sample)}`);
    }
  }

  return problems;
}

async function checkFailureModes(): Promise<string[]> {
  const problems: string[] = [];
  const expectations: [MockFailureMode, string][] = [
    ["network", "network_error"],
    ["http_500", "internal_error"],
    ["rate_limited", "rate_limited"],
    ["upstream_unavailable", "upstream_unavailable"],
    ["mid_stream", "stream_interrupted"],
    ["contract_violation", "contract_violation"],
  ];

  for (const [mode, expectedCode] of expectations) {
    const client = new MockChatClient({
      profile: "instant",
      seed: SEED,
      now: () => FIXED_NOW,
      failure: mode,
    });
    const events = await collect(client, {
      conversation_id: "conv_failure",
      message: { id: "msg_failure", content: "What happens if my delivery is late?" },
      history: [],
      options: null,
    });

    const last = events[events.length - 1];
    if (!last || last.type !== "error") {
      problems.push(`failure mode "${mode}" did not terminate with an error event`);
      continue;
    }
    if (last.error.code !== expectedCode) {
      problems.push(`failure mode "${mode}" reported ${last.error.code}, expected ${expectedCode}`);
    }
    if (mode === "mid_stream" && !events.some((event) => event.type === "message.delta")) {
      problems.push('failure mode "mid_stream" produced no partial text to preserve');
    }
  }

  return problems;
}

/* -----------------------------------------------------------------------------------------------
 * Reference SSE server
 * ---------------------------------------------------------------------------------------------*/

interface ReferenceServer {
  url: string;
  close: () => Promise<void>;
}

function startReferenceServer(options: {
  port: number;
  seed?: number;
  fixedNow?: boolean;
}): Promise<ReferenceServer> {
  const client = new MockChatClient({
    profile: options.fixedNow ? "instant" : "demo",
    seed: options.seed,
    now: options.fixedNow ? () => FIXED_NOW : undefined,
  });

  const server = http.createServer((request, response) => {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept, X-Request-Id",
      "Access-Control-Expose-Headers": "X-Request-Id, Retry-After",
    };

    if (request.method === "OPTIONS") {
      response.writeHead(204, cors).end();
      return;
    }

    const url = new URL(request.url ?? "/", "http://localhost");

    if (request.method === "GET" && url.pathname === "/health") {
      void client.getHealth().then((health) => {
        const body = JSON.stringify(health);
        response
          .writeHead(health.status === "down" ? 503 : 200, {
            ...cors,
            "Content-Type": "application/json",
          })
          .end(body);
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/documents") {
      void client.listDocuments().then((documents) => {
        response
          .writeHead(200, { ...cors, "Content-Type": "application/json" })
          .end(JSON.stringify(documents));
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/feedback") {
      request.resume();
      request.on("end", () => response.writeHead(204, cors).end());
      return;
    }

    if (request.method === "POST" && url.pathname === "/chat") {
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        } catch {
          sendError(response, 400, "invalid_request", "Body was not valid JSON.", cors);
          return;
        }

        const validated = ChatRequestSchema.safeParse(parsed);
        if (!validated.success) {
          sendError(response, 422, "validation_error", "Request failed validation.", cors, {
            details: validated.error.issues.map((issue) => ({
              path: issue.path.map(String).join("."),
              message: issue.message,
            })),
          });
          return;
        }

        response.writeHead(200, {
          ...cors,
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no",
          Connection: "keep-alive",
        });

        const controller = new AbortController();
        request.on("close", () => controller.abort());

        void (async () => {
          let sequence = 0;
          try {
            for await (const event of client.streamChat(validated.data, {
              signal: controller.signal,
            })) {
              response.write(
                `event: ${event.type}\nid: ${sequence}\ndata: ${JSON.stringify(event)}\n\n`,
              );
              sequence += 1;
            }
          } finally {
            response.end();
          }
        })();
      });
      return;
    }

    sendError(
      response,
      404,
      "invalid_request",
      `No route for ${request.method} ${url.pathname}.`,
      cors,
    );
  });

  return new Promise((resolve) => {
    server.listen(options.port, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : options.port;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise<void>((done) => {
            server.closeAllConnections?.();
            server.close(() => done());
          }),
      });
    });
  });
}

function sendError(
  response: http.ServerResponse,
  status: number,
  code: string,
  message: string,
  headers: Record<string, string>,
  extra: Record<string, unknown> = {},
): void {
  response.writeHead(status, { ...headers, "Content-Type": "application/json" }).end(
    JSON.stringify({
      error: {
        code,
        message,
        retryable: status >= 500,
        request_id: null,
        retry_after_ms: null,
        details: null,
        ...extra,
      },
    }),
  );
}

/* -----------------------------------------------------------------------------------------------
 * Commands
 * ---------------------------------------------------------------------------------------------*/

function commandExport(): void {
  const outputDir = path.join(PROJECT_ROOT, "docs", "contract");
  mkdirSync(outputDir, { recursive: true });

  const targets: [string, z.ZodType][] = [
    ["chat-request", ChatRequestSchema],
    ["chat-stream-event", ChatStreamEventSchema],
    ["assistant-message", AssistantMessageSchema],
    ["health-response", HealthResponseSchema],
    ["documents-response", DocumentsResponseSchema],
    ["feedback-request", FeedbackRequestSchema],
    ["error-envelope", ErrorEnvelopeSchema],
  ];

  for (const [name, schema] of targets) {
    const jsonSchema = z.toJSONSchema(schema, {
      io: "input",
      unrepresentable: "any",
      cycles: "ref",
    });
    const withMeta = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      title: name,
      description: `QuickBite Support contract ${CONTRACT_VERSION} — see docs/API_CONTRACT.md`,
      ...jsonSchema,
    };
    const file = path.join(outputDir, `${name}.schema.json`);
    writeFileSync(file, `${JSON.stringify(withMeta, null, 2)}\n`, "utf8");
    console.log(`wrote ${path.relative(PROJECT_ROOT, file)}`);
  }
}

async function commandCheck(): Promise<number> {
  const scenarios = buildScenarios();
  const client = new MockChatClient({
    profile: "instant",
    seed: SEED,
    now: () => FIXED_NOW,
  });

  const failures: Failure[] = [];
  const coverage = new Set<string>();

  for (const [index, scenario] of scenarios.entries()) {
    const events = await collect(client, toRequest(scenario, index));
    updateCoverage(events, coverage);
    const problems = validateScenario(scenario, events);
    if (problems.length > 0) failures.push({ scenario: scenario.name, problems });
  }

  const fixtureProblems = checkFixtures();
  if (fixtureProblems.length > 0)
    failures.push({ scenario: "fixtures", problems: fixtureProblems });

  const failureModeProblems = await checkFailureModes();
  if (failureModeProblems.length > 0) {
    failures.push({ scenario: "failure modes", problems: failureModeProblems });
  }

  console.log(
    `Checked ${scenarios.length} scenarios, ${SCRIPTED_CONVERSATIONS.length} scripted conversations, and 6 failure modes against contract ${CONTRACT_VERSION}.`,
  );
  printCoverage(coverage);
  return report(failures);
}

async function commandCheckLive(baseUrl: string): Promise<number> {
  const client = new HttpChatClient({ baseUrl, headersTimeoutMs: 30_000 });
  const failures: Failure[] = [];
  const coverage = new Set<string>();

  console.log(`Checking live backend at ${baseUrl}\n`);

  try {
    const health = await client.getHealth();
    console.log(
      `GET /health -> ${health.status}; model ${health.models.primary.name} (available: ${health.models.primary.available}); ${health.vector_store.document_count} documents`,
    );
    if (health.contract_version && health.contract_version !== CONTRACT_VERSION) {
      console.log(
        `  ! contract_version ${health.contract_version} differs from the frontend's ${CONTRACT_VERSION}`,
      );
    }
  } catch (error) {
    failures.push({
      scenario: "GET /health",
      problems: [error instanceof Error ? error.message : String(error)],
    });
  }

  // A live backend has its own corpus, so only structural expectations are asserted here.
  const probes: Scenario[] = [
    {
      name: "live/policy question",
      question: "What happens if my delivery is late?",
      history: [],
      expect: ["answer"],
    },
    { name: "live/order lookup", question: "Where is my order QB-48213?", history: [], expect: [] },
    {
      name: "live/out of scope",
      question: "What is the capital of France?",
      history: [],
      expect: ["refusal"],
    },
  ];

  for (const [index, probe] of probes.entries()) {
    const events = await collect(client, toRequest(probe, index));
    updateCoverage(events, coverage);
    const problems = validateScenario(probe, events);
    if (problems.length > 0) failures.push({ scenario: probe.name, problems });
    const deltas = events.filter((event) => event.type === "message.delta").length;
    console.log(`${probe.name}: ${events.length} events, ${deltas} deltas`);
    if (deltas === 1) {
      console.log("  ! only one delta arrived — the stream is probably being buffered by a proxy");
    }
  }

  printCoverage(coverage);
  return report(failures);
}

async function commandVerify(): Promise<number> {
  const server = await startReferenceServer({ port: 0, seed: SEED, fixedNow: true });
  console.log(`Reference server on ${server.url}`);

  try {
    const scenarios = buildScenarios();
    const mock = new MockChatClient({ profile: "instant", seed: SEED, now: () => FIXED_NOW });
    const httpClient = new HttpChatClient({ baseUrl: server.url });
    const failures: Failure[] = [];

    for (const [index, scenario] of scenarios.entries()) {
      const request = toRequest(scenario, index);
      const direct = await collect(mock, request);
      const overWire = await collect(httpClient, request);

      const problems = validateScenario(scenario, overWire);
      // Canonical comparison: Zod rebuilds parsed objects in schema-declaration order, and JSON
      // object key order carries no meaning.
      if (canonicalJson(direct) !== canonicalJson(overWire)) {
        const firstDifference = direct.findIndex(
          (event, position) => canonicalJson(event) !== canonicalJson(overWire[position]),
        );
        problems.push(
          `events differ after the SSE round trip at index ${firstDifference}: ` +
            `${JSON.stringify(direct[firstDifference])?.slice(0, 160)} vs ` +
            `${JSON.stringify(overWire[firstDifference])?.slice(0, 160)}`,
        );
      }
      if (problems.length > 0) failures.push({ scenario: scenario.name, problems });
    }

    console.log(
      `Round-tripped ${scenarios.length} scenarios through SSE framing, sockets, and Zod validation.`,
    );
    return report(failures);
  } finally {
    await server.close();
  }
}

async function commandServe(port: number): Promise<number> {
  const server = await startReferenceServer({ port });
  console.log(`Reference contract server listening on ${server.url}`);
  console.log("Routes: POST /chat (SSE), GET /health, GET /documents, POST /feedback");
  console.log(
    `\nPoint the app at it with:\n  NEXT_PUBLIC_API_MODE=live NEXT_PUBLIC_API_URL=${server.url} pnpm dev`,
  );
  console.log(
    `\nOr watch the wire format directly:\n  curl -N -H "Content-Type: application/json" -d '{"conversation_id":"conv_1","message":{"id":"m1","content":"What happens if my delivery is late?"},"history":[]}' ${server.url}/chat\n`,
  );
  await new Promise(() => {
    // Run until interrupted.
  });
  return 0;
}

/** Stable stringify with sorted keys, so equality ignores property order. */
function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, entry]) => [key, sortKeys(entry)]),
    );
  }
  return value;
}

function report(failures: Failure[]): number {
  if (failures.length === 0) {
    console.log("\nAll contract checks passed.");
    return 0;
  }
  console.log(`\n${failures.length} failing scenario(s):\n`);
  for (const failure of failures) {
    console.log(`  ${failure.scenario}`);
    for (const problem of failure.problems) console.log(`    - ${problem}`);
  }
  return 1;
}

/* -----------------------------------------------------------------------------------------------
 * Entry point
 * ---------------------------------------------------------------------------------------------*/

const [command = "check", ...rest] = process.argv.slice(2);
const urlIndex = rest.indexOf("--url");
const liveUrl = urlIndex === -1 ? null : rest[urlIndex + 1];

let exitCode = 0;
switch (command) {
  case "export":
    commandExport();
    break;
  case "check":
    exitCode = liveUrl ? await commandCheckLive(liveUrl) : await commandCheck();
    break;
  case "verify":
    exitCode = await commandVerify();
    break;
  case "serve":
    exitCode = await commandServe(Number(rest[0]) || 8787);
    break;
  default:
    console.error(`Unknown command "${command}". Use export, check, verify, or serve.`);
    exitCode = 1;
}

process.exitCode = exitCode;
