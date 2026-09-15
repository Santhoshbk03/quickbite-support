# QuickBite Support

A demo customer support app for a food delivery service. You can chat with a support assistant, look up orders, and read the policies behind every answer.

**Live demo:** [quickbite-support.vercel.app](https://quickbite-support.vercel.app). The demo runs on built-in sample data.

## Features

- **Chat.** You can ask about an order by its ID, or ask about a policy.
  - Answers are a short paragraph with bullet points, and they link to the policies they used.
  - When an answer is about a specific order, it includes an order card.
  - If no policy covers a question, the assistant says so instead of guessing.
  - Thumbs up and thumbs down send feedback on an answer.
  - Conversations are saved in the browser.
- **Orders.** There's a list of orders, and each order has a page showing the delivery timeline, items, charges, and driver.
- **Policies.** You can search and filter the support policies and open a page for each one.
- **Demo mode.**
  - Everything works without a backend.
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

## Connecting a backend

Set these in `.env.local`, or in your hosting provider's environment settings:

```bash
NEXT_PUBLIC_API_MODE=live
NEXT_PUBLIC_API_URL=http://localhost:8000
```

The backend needs seven JSON endpoints:

| Method | Path                    | Purpose                        |
| ------ | ----------------------- | ------------------------------ |
| GET    | `/health`               | API status                     |
| POST   | `/chat`                 | Answer a message               |
| GET    | `/orders`               | List orders                    |
| GET    | `/orders/{order_id}`    | One order                      |
| GET    | `/policies`             | List policies                  |
| GET    | `/policies/{policy_id}` | One policy with its sections   |
| POST   | `/feedback`             | Thumbs up or down on an answer |

[docs/API.md](docs/API.md) has the full request and response shapes, error handling, and CORS setup.

## Project structure

```
src/
  app/                  Routes: / (chat), /orders, /orders/[id], /policies, /policies/[id]
  components/
    chat/               Chat screen, messages, composer
    orders/             Order list, order detail, order card
    policies/           Policy list and detail
    site/               Header, API status, fallback banner, providers
    ui/                 Buttons, badges, sidebar, timeline, tooltips
  hooks/                useApiQuery, useCopy, useMediaQuery
  lib/
    api/                types.ts (Zod contract), http.ts (live client), mock.ts (demo data), index.ts (api + fallback)
    chat/store.ts       Conversations (Zustand, saved to localStorage)
    fixtures/           Sample orders and policy documents
docs/API.md             API reference for the backend
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
3. To use a backend, also set `NEXT_PUBLIC_API_MODE` and `NEXT_PUBLIC_API_URL`.

Demo mode needs no other environment variables. The `NEXT_PUBLIC_*` values are built into the bundle, so redeploy after changing them.
