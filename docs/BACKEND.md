# Connecting the FastAPI backend

The frontend's live client ([`src/lib/api/http.ts`](../src/lib/api/http.ts)) is written against the QuickBite FastAPI backend: `http://127.0.0.1:8000` locally, and `https://delivery-agent-4tvc.onrender.com` for the deployed site. [API.md](API.md) is the fuller contract the frontend was designed around; this page describes what is connected today.

## Setup

Create `.env.local` and restart `pnpm dev`:

```bash
NEXT_PUBLIC_API_MODE=live
NEXT_PUBLIC_API_URL=/api/backend
BACKEND_URL=http://127.0.0.1:8000
```

The backend doesn't send CORS headers, so the browser can't call it directly. It calls `/api/backend/*` on the Next.js server instead ([`src/app/api/backend/[...path]/route.ts`](../src/app/api/backend/%5B...path%5D/route.ts)), which forwards to `BACKEND_URL`. Only the routes below are forwarded.

If the backend is down, the app switches to demo data and shows a banner, then retries every 30 seconds.

**Deployed site (Vercel).** The production environment has `NEXT_PUBLIC_API_MODE=live`, `NEXT_PUBLIC_API_URL=/api/backend`, `BACKEND_URL=https://delivery-agent-4tvc.onrender.com`, and `NEXT_PUBLIC_DEMO_EMAILS=arjun.mehta@example.com`. The `NEXT_PUBLIC_*` values are built into the bundle, so redeploy after changing them. The Render free tier sleeps when idle; the first requests after that can time out, and the app shows demo data until the backend answers a health check.

## What calls what

| Frontend         | Backend                                   | Notes                                                                        |
| ---------------- | ----------------------------------------- | ---------------------------------------------------------------------------- |
| Sign in          | `POST /userdetails?email=`                | The first entry of `userdetails` becomes the customer (`email`, `name`).     |
| Orders page      | `POST /user_orders_id?email=`             | Returns full orders. Sorted newest first.                                    |
| Order page       | `POST /user_order_detail?orderid=`        | Shown only when the order's `customer_email` matches the signed-in customer. |
| Chat             | `POST /chat` `{message, email, messages}` | See below.                                                                   |
| API status badge | `GET /openapi.json`                       | There's no health route, so this checks that the backend is reachable.       |
| Policies pages   | —                                         | No endpoint yet. The pages say so instead of showing sample policies.        |
| Thumbs up / down | —                                         | No endpoint yet. Ratings stay in the browser.                                |

Every data route answers HTTP 200 with `{"status": 200, "userdetails": ...}`. When `userdetails` is a string (for example `"No customer Found for this mail id"` or `"no match found"`), the frontend treats it as not found.

## How chat is adapted

- **Conversation state.** `/chat` returns `messages`, the whole agent transcript (system prompt, turns, tool calls, and tool results), and only adds its system prompt when the incoming `messages` is empty. The browser stores that transcript per conversation and sends it back unchanged with the next message.
- **Answer.** `responce` (or `response`) is shown as Markdown.
- **Sources.** Each `.md` file named in a knowledge-base result becomes a source chip, for example `QB-REF-002-refund-processing-times.md` becomes "Refund processing times". The wording of those results varies, so only the file name is used. The chips don't link anywhere, because there's no policies endpoint to open.
- **"No policy covers this."** Shown when the only tool used this turn was `search_knowledge_base` and every search returned `No related content found!`.
- **Order card.** When the answer mentions exactly one order ID that belongs to the customer, the frontend fetches it from `/user_order_detail` and shows a card.
- **Message IDs** are generated in the browser.

## Backend issues found while connecting

These are worth fixing on the backend; the first three matter most.

1. **`/chat` trusts the transcript it receives.** The browser sends back `messages` including the system prompt and earlier tool results, and a customer can edit them. They could replace the instructions or insert a fake order record, for example to get a refund under ₹500 approved automatically. Keep the transcript on the server, keyed by a session ID, and accept only the new message from the browser.
2. **`/chat` returns internal data.** The response includes the full system prompt and raw tool output, such as every order on the account. Return only the answer (plus anything the UI needs, like cited files).
3. **`/user_order_detail` returns any order by ID.** There's no check that the order belongs to the caller. The frontend hides other customers' orders, but anyone can call the API directly. Take the customer's identity and check it.
4. **Email is the only identity.** Anyone who types someone's email can see their orders. Fine for demo data; use a signed token for real customers.
5. **Errors are HTTP 200.** "Not found" is a 200 with a text message. Returning `404` with `{"detail": ...}` would be simpler to handle.
6. **Inconsistent order fields.** Order `QB-2026-411004` has `"refund": true`, while other orders use an object or `null`. The frontend accepts it, but one shape would be clearer.
7. **Small things.** `responce` is misspelled, the routes are all `POST` even for reads, and adding FastAPI's `CORSMiddleware` would let the browser call the backend without the proxy.
