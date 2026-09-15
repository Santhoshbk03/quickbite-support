# Going live: wiring the real backend

The frontend already talks to your backend through one interface, `ChatClient`
([`src/lib/api/client.ts`](../src/lib/api/client.ts)). The deployed demo uses `MockChatClient`. Going live swaps in
`HttpChatClient` — **an env var, not a code change**.

---

## 1. The switch

Set these in Vercel → Project → Settings → Environment Variables, then redeploy. `NEXT_PUBLIC_*` values are inlined
at build time, so a redeploy is required after changing them.

| Variable                           | Value                                     | Notes                                                                                                                                  |
| ---------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_MODE`             | `live`                                    | Default is `mock`.                                                                                                                     |
| `NEXT_PUBLIC_API_URL`              | `https://api.your-host.com`               | May include a path prefix (`…/v1`). If `live` is set without it, the app **degrades to mock** and shows a banner rather than breaking. |
| `NEXT_PUBLIC_LANGFUSE_PROJECT_URL` | `https://cloud.langfuse.com/project/<id>` | Optional. Builds trace deep links when the backend sends `trace_id` but not `trace_url`.                                               |
| `NEXT_PUBLIC_SITE_URL`             | `https://quickbite-support.vercel.app`    | Optional. Canonical URL for Open Graph metadata. Vercel's own URL is used if unset.                                                    |

Nothing else in `src/components` or `src/app` references the backend.

## 2. Files you might touch

| File                                                              | Why                                                                                                                                                                             |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`src/lib/api/http-client.ts`](../src/lib/api/http-client.ts)     | Complete against the contract and verified over a real SSE socket. Every place a real backend could legitimately differ is marked `TODO(integration)`. Confirm and delete them. |
| [`src/lib/api/schemas.ts`](../src/lib/api/schemas.ts)             | Only if you change the contract. Bump `CONTRACT_VERSION`, re-run `pnpm contract:export`, and update `docs/API_CONTRACT.md`.                                                     |
| [`src/data/evals.json`](../src/data/evals.json)                   | Your real eval numbers. Set `is_placeholder: false`. The build validates the file.                                                                                              |
| [`src/lib/api/mock/profiles.ts`](../src/lib/api/mock/profiles.ts) | `PIPELINE` holds the mock's placeholder threshold, models, and pricing. Match them to the real backend so demo mode and live mode tell the same story.                          |

## 3. Prove your backend matches the contract

```bash
# See exactly what the wire should look like (reference server, same scenarios as the demo)
pnpm contract:serve
curl -N -H "Content-Type: application/json" \
  -d '{"conversation_id":"conv_1","message":{"id":"m1","content":"What happens if my delivery is late?"},"history":[]}' \
  http://127.0.0.1:8787/chat

# Validate your backend: schemas, stream grammar, and which optional fields it sends
pnpm contract:check --url http://localhost:8000
```

`contract:check --url` does three things:

- Calls `GET /health` and three probe prompts: policy, order lookup, and out of scope.
- Validates every event with the same Zod schemas the UI uses, and checks the event _sequence_ against the grammar in `API_CONTRACT.md §1.5`.
- Prints an optional-field coverage checklist. It also warns if a response arrives as a single delta, which usually means a proxy is buffering the stream.

Seed Pydantic models from the generated JSON Schemas instead of retyping them:

```bash
datamodel-codegen --input docs/contract/chat-stream-event.schema.json --input-file-type jsonschema --output models.py
```

## 4. CORS

The browser calls your API directly. Nothing proxies through Vercel, so your backend must allow the frontend
origin.

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://quickbite-support.vercel.app",   # production
        "http://localhost:3000",                  # local dev
    ],
    # Vercel preview deployments get unique subdomains:
    allow_origin_regex=r"https://quickbite-support-[a-z0-9-]+-santhoshbk03s-projects\.vercel\.app",
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Accept", "X-Request-Id"],
    expose_headers=["X-Request-Id", "Retry-After"],
    allow_credentials=False,
)
```

Replace the preview regex with the real pattern from your first preview deployment's URL.

A CORS failure surfaces in the client as `network_error`, the same as a dead backend, so it **triggers the replay
fallback**. If the banner appears in live mode, check the browser console for a CORS message first.

## 5. Streaming through proxies

Server-sent events only feel like streaming if nothing between the model and the browser buffers them. The usual
culprits:

| Layer                                                       | Problem                                                       | Fix                                                                                                 |
| ----------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Gzip / compression middleware                               | Buffers until it has enough bytes to compress.                | Exclude `text/event-stream`, or don't add `GZipMiddleware` globally.                                |
| nginx (self-hosted or PaaS routers)                         | `proxy_buffering on` by default.                              | Send `X-Accel-Buffering: no` (already in the contract) or set `proxy_buffering off`.                |
| Cloudflare                                                  | Can buffer and compress.                                      | Disable compression on the API route; don't enable "Rocket Loader"-style features for the API host. |
| Idle timeouts (Heroku ~55s, AWS ALB 60s, many PaaS 30–100s) | Kill a quiet stream during a slow generation or a cold start. | The `: keep-alive` heartbeat every 10s from the contract.                                           |
| Serverless functions with response buffering                | The whole response is returned at the end.                    | Use a host with long-lived HTTP responses (below), or a streaming-capable runtime.                  |

**Verify the stream survives the proxy**, from outside your network, against the public URL:

```bash
curl -N -s -X POST https://api.your-host.com/chat \
  -H "Content-Type: application/json" -H "Accept: text/event-stream" \
  -d '{"conversation_id":"conv_probe","message":{"id":"m1","content":"What happens if my delivery is late?"},"history":[]}' \
  | while IFS= read -r line; do printf '%s  %s\n' "$(date +%H:%M:%S.%N | cut -c1-12)" "$line"; done
```

The timestamps should spread across the generation time. If every line shares one timestamp, something is
buffering. `pnpm contract:check --url` flags the same thing.

**Hosting that streams well:** Render, Railway, Fly.io, and Google Cloud Run all hold long-lived HTTP responses and
pass chunked responses through. Avoid putting the SSE endpoint behind anything that buffers by default.

## 6. Health, cold starts, and the fallback

- **Polling.** The header badge polls `GET /health` every 60s in live mode. Keep it under 500ms and never call the LLM from it (`API_CONTRACT.md §7`).
- **Cold starts.** Free tiers sleep. Keep the instance warm with an uptime monitor (UptimeRobot, Better Stack, or a scheduled GitHub Action) hitting `/health` every 10 minutes during the hours reviewers are likely to visit.
- **Fallback triggers.** Any failure _before_ `message.start` except our own validation errors hands that request to the fixture-backed mock: network error, CORS, timeout, 429, 5xx, or model unavailable.
  - The banner reads _"Live backend unavailable — replaying recorded sessions."_
  - Answers are tagged **Recorded** in the thread and the inspector.
  - The live backend is retried after 60 seconds, or immediately when `/health` recovers.
- **Failures mid-answer** never fall back, which would splice two answers together. They show a retryable error and keep the partial text.
- **Client timeouts.** Headers from `/chat` within 20s; `/health` within 5s.

## 7. Field wiring checklist

Tick these off as the live backend sends them. The UI hides any section whose optional data is missing, so
partial wiring is safe.

**P0: required. The UI treats absence as a contract violation.**

- [ ] SSE framing: one-line JSON `data`, `type` in the payload, blank-line terminator, exactly one terminal event
- [ ] `message.start` → `message.delta`* → `message.end` | `error`
- [ ] `retrieval` event before deltas, with all top-k chunks: `rank`, `distance`, `passed_threshold`, `text`, `document.{id,title}`
- [ ] `used_in_answer` in `message.end` matches the `[n]` markers in the final content (drives citation chips and the inspector's cited highlighting)
- [ ] `refusal` with `below_threshold`, `threshold`, `distance_metric`, `closest_match` (drives the refusal card)
- [ ] `tool_call.start` / `tool_call.result` for `lookup_order` with the P0 order fields (drives the order card)
- [ ] `GET /health`: `status`, `checked_at`, `models.primary`, `vector_store.{provider, available, document_count}`
- [ ] Error envelope on non-2xx responses

**P1: sections hide without these**

- [ ] `metadata.trace_id` → inspector trace section
- [ ] `metadata.model`, `metadata.params` → model & cost section, fallback badge
- [ ] `metadata.usage` → token counts and cost estimate
- [ ] `metadata.latency_ms` → pipeline waterfall (sequential layout)
- [ ] `tool_call.content_offset` → the order card sits where the call happened in the answer
- [ ] `document.section` → citation previews and source panel
- [ ] `refusal.suggestions` → refusal card suggestions (a curated fallback list is used otherwise)
- [ ] `history[].tool_calls` accepted → follow-ups about an order work without another lookup

**P2: nice to have**

- [ ] `status` events → truthful "Searching policy documents / Looking up your order" thinking state
- [ ] `citation` events → chunks light up as cited while the answer streams
- [ ] `metadata.spans` → true waterfall showing generation → tool → generation
- [ ] `retrieval.standalone_query` → "Rewritten for retrieval" in the inspector
- [ ] `metadata.trace_url`, `metadata.estimated_cost_usd`
- [ ] `GET /documents`, `POST /feedback` (Langfuse `user_feedback` score)

## 8. Go-live sequence

1. `pnpm contract:check --url http://localhost:8000` passes locally.
2. Deploy the backend. Run the curl streaming probe against the public URL.
3. Add CORS origins for production and preview.
4. Set `NEXT_PUBLIC_API_MODE=live` and `NEXT_PUBLIC_API_URL` on a Vercel **preview** environment first. Redeploy and click through all six example questions.
5. Check the header badge says **Live** and no banner appears. Open the inspector on each example.
6. Promote the env vars to production.
7. Keep `mock` as a one-variable rollback: set `NEXT_PUBLIC_API_MODE=mock` and redeploy.
