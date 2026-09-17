# QuickBite Support

A demo customer support app for a food delivery service. Customers sign in with their email, chat with a support assistant, look up their orders, and read the policies behind every answer.

**Live demo:** [quickbite-support.vercel.app](https://quickbite-support.vercel.app). It's connected to the hosted FastAPI backend; sign in with `arjun.mehta@example.com`. The backend runs on Render's free tier, so the first request after it has been idle can take a minute, and the app shows demo data until it responds.

## Features

- **Sign-in.** Customers sign in with the email on their QuickBite account. Every page needs a signed-in customer.
  - The main QuickBite app can link straight in with `/login?email=customer@example.com&next=/orders`.
  - Orders and chat only ever show the signed-in customer's orders.
  - Signing out clears the conversations saved in the browser.
- **Chat.** Customers can ask about their orders ("Where is my latest order?", or by order ID) or about a policy.
  - Answers are a short paragraph with bullet points, and they link to the policies they used.
  - When an answer is about a specific order, it includes an order card.
  - If no policy covers a question, the assistant says so instead of guessing.
  - Thumbs up and thumbs down send feedback on an answer.
- **Orders.** A list of the customer's orders, and a page for each one showing the delivery timeline, items, charges, and driver.
- **Policies.** Searchable, filterable support policies with a page for each one.
- **Demo mode.**
  - Everything works without a backend, using two demo accounts: `priya.sharma@example.com` and `arjun.mehta@example.com`.
  - Two environment variables point the app at a real API.
  - If that API goes down during a demo, the app switches to sample data and shows a banner saying so.

## Tech stack

Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS v4, Zustand, Zod, Base UI, Motion, lucide-react, and pnpm.

## Getting started

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Then open http://localhost:3000.

## Connecting the backend

The live client in `src/lib/api/http.ts` is written against the QuickBite FastAPI backend. The backend doesn't send CORS headers, so the browser calls a same-origin proxy at `/api/backend/*`, which forwards to it. Put this in `.env.local` and restart `pnpm dev`:

```bash
NEXT_PUBLIC_API_MODE=live
NEXT_PUBLIC_API_URL=/api/backend
BACKEND_URL=http://127.0.0.1:8000
```

| Frontend         | Backend                            |
| ---------------- | ---------------------------------- |
| Sign in          | `POST /userdetails?email=`         |
| Orders           | `POST /user_orders_id?email=`      |
| Order detail     | `POST /user_order_detail?orderid=` |
| Chat             | `POST /chat`                       |
| API status badge | `GET /openapi.json`                |

Policies and feedback don't have backend endpoints yet. [docs/BACKEND.md](docs/BACKEND.md) explains how responses are adapted and lists backend issues found while connecting it. [docs/API.md](docs/API.md) is the fuller contract the frontend was designed around.

## Project structure

```
src/
  app/
    api/backend/        Proxy to the FastAPI backend (it has no CORS)
    login/              Login page
    (app)/              Signed-in pages: / (chat), /orders, /orders/[id], /policies, /policies/[id]
  components/
    auth/               Login screen and the sign-in gate
    chat/               Chat screen, messages, composer
    orders/             Order list, order detail, order card
    policies/           Policy list and detail
    site/               Header, API status, fallback banner, providers
    ui/                 Buttons, badges, sidebar, timeline, tooltips
  hooks/                useApiQuery, useCopy, useMediaQuery
  lib/
    api/                types.ts (Zod contract), http.ts (FastAPI backend client), mock.ts (demo data), index.ts (api + fallback)
    auth/session.ts     The signed-in customer (Zustand, saved to localStorage)
    chat/store.ts       Conversations (Zustand, saved to localStorage)
    fixtures/           Sample customers, orders, and policy documents
docs/API.md             The contract the frontend was designed around
docs/BACKEND.md         How the FastAPI backend is connected today
```

The UI only reads data through `api` from `@/lib/api`. Switching from demo data to a real backend changes no component code.

## Scripts

| Command          | What it does                      |
| ---------------- | --------------------------------- |
| `pnpm dev`       | Start the dev server              |
| `pnpm build`     | Production build                  |
| `pnpm start`     | Serve the production build        |
| `pnpm lint`      | ESLint                            |
| `pnpm typecheck` | TypeScript                        |
| `pnpm format`    | Prettier                          |
| `pnpm verify`    | Typecheck, lint, and format check |

## Deploying

The live demo runs on Vercel.

1. Import the repository into Vercel.
2. Set `ENABLE_EXPERIMENTAL_COREPACK=1` so Vercel uses the pinned pnpm version.
3. To use the backend, also set `NEXT_PUBLIC_API_MODE=live`, `NEXT_PUBLIC_API_URL=/api/backend`, `BACKEND_URL` (the backend's URL), and optionally `NEXT_PUBLIC_DEMO_EMAILS`.

Demo mode needs no other environment variables. The `NEXT_PUBLIC_*` values are built into the bundle, so redeploy after changing them.
