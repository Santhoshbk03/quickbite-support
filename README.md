# QuickBite Support

A demo customer support app for a food delivery service. Customers sign in with their email, chat with a support assistant, look up their orders, and read the policies behind every answer.

**Live demo:** [quickbite-support.vercel.app](https://quickbite-support.vercel.app). The demo runs on built-in sample data; pick one of the demo accounts on the login page.

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

## Connecting a backend

Set these in `.env.local`, or in your hosting provider's environment settings:

```bash
NEXT_PUBLIC_API_MODE=live
NEXT_PUBLIC_API_URL=http://localhost:8000
```

The backend needs eight JSON endpoints. After sign-in, the frontend sends the customer's email as an `X-Customer-Email` header so the backend can return only that customer's data.

| Method | Path                    | Purpose                                   |
| ------ | ----------------------- | ----------------------------------------- |
| GET    | `/health`               | API status                                |
| POST   | `/auth/login`           | Check that an email belongs to a customer |
| POST   | `/chat`                 | Answer a message                          |
| GET    | `/orders`               | The customer's orders                     |
| GET    | `/orders/{order_id}`    | One of the customer's orders              |
| GET    | `/policies`             | List policies                             |
| GET    | `/policies/{policy_id}` | One policy with its sections              |
| POST   | `/feedback`             | Thumbs up or down on an answer            |

[docs/API.md](docs/API.md) has the full request and response shapes, how sign-in works, error handling, and CORS setup.

> Email-only sign-in identifies a customer but doesn't prove who they are, so it suits demo data. docs/API.md explains how to switch to a signed token for real customers.

## Project structure

```
src/
  app/
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
    api/                types.ts (Zod contract), http.ts (live client), mock.ts (demo data), index.ts (api + fallback)
    auth/session.ts     The signed-in customer (Zustand, saved to localStorage)
    chat/store.ts       Conversations (Zustand, saved to localStorage)
    fixtures/           Sample customers, orders, and policy documents
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
