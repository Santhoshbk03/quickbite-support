# QuickBite Support API

The frontend needs **8 JSON endpoints**. Until they exist it runs on built-in demo data. To connect a backend:

```bash
NEXT_PUBLIC_API_MODE=live
NEXT_PUBLIC_API_URL=http://localhost:8000
```

| #   | Method | Path                    | Needs `X-Customer-Email` | Used by                               |
| --- | ------ | ----------------------- | ------------------------ | ------------------------------------- |
| 1   | GET    | `/health`               | No                       | Status badge in the header            |
| 2   | POST   | `/auth/login`           | No                       | Login page                            |
| 3   | POST   | `/chat`                 | Yes                      | Chat                                  |
| 4   | GET    | `/orders`               | Yes                      | Orders page                           |
| 5   | GET    | `/orders/{order_id}`    | Yes                      | Order detail page                     |
| 6   | GET    | `/policies`             | No                       | Policies page                         |
| 7   | GET    | `/policies/{policy_id}` | No                       | Policy page, and source links in chat |
| 8   | POST   | `/feedback`             | Yes                      | Thumbs up / down on an answer         |

The source of truth is [`src/lib/api/types.ts`](../src/lib/api/types.ts): every response is validated against those Zod schemas. The live client is [`http.ts`](../src/lib/api/http.ts), and the demo data is [`mock.ts`](../src/lib/api/mock.ts).

## Signing in

The whole app requires a signed-in customer, and customers sign in with their email only.

1. **Getting to the login page.** The main QuickBite app sends customers to `/login`. It can also link straight in with `/login?email=priya.sharma@example.com&next=/orders`. That link signs the customer in, removes the email from the address bar, and opens `next` (any path on this site; defaults to chat).
2. **Checking the email.** The login page calls `POST /auth/login`, which checks that the email belongs to a customer.
3. **Identifying the customer.** Every later request carries the header `X-Customer-Email: priya.sharma@example.com`. Use it to scope the data:
   - `GET /orders` returns only that customer's orders.
   - `GET /orders/{order_id}` returns `404` for an order that belongs to someone else. Don't reveal that it exists.
   - `POST /chat` looks up only that customer's orders. "Where is my order?" can mean their latest one.
4. **Ending a session.** If the header is missing or doesn't match a customer, return `401` with `{"detail": "Sign in to continue."}`. The app signs the customer out and returns to the login page.

A FastAPI dependency covers step 3 and step 4:

```python
from fastapi import Depends, Header, HTTPException

def current_customer(x_customer_email: str | None = Header(default=None)):
    email = (x_customer_email or "").strip().lower()
    customer = customers_by_email.get(email)
    if customer is None:
        raise HTTPException(status_code=401, detail="Sign in to continue.")
    return customer

@app.get("/orders")
def list_orders(customer=Depends(current_customer)):
    return {"orders": orders_for(customer["email"])}
```

> **Security note.** An email identifies a customer but doesn't prove who they are: anyone who knows someone's email can see their orders. That's fine for demo data. For real customers, have the main app pass a short-lived signed token instead, both in the link and as an `Authorization: Bearer` header. On the frontend that's a change to `src/lib/api/http.ts` and the login handoff in `src/components/auth/login-screen.tsx`.

## Conventions

- **Format.** JSON with snake_case field names.
- **Timestamps.** ISO 8601, preferably with an offset: `2026-08-12T00:30:00+05:30`.
- **Money.** Amounts are numbers in major units (rupees): `366.0`. `currency` defaults to `INR`.
- **Optional fields.** They can be `null` or left out.
- **Unknown fields.** Extra fields are ignored and dropped. `customer_email` and `customer_id` on an order aren't needed in responses.
- **Errors.** Return a non-2xx status with FastAPI's usual body, `{"detail": "Order not found"}`. A string `detail` is shown to the user.
- **404.** Unknown order and policy ids should return `404`. The UI shows a "not found" state.
- **Outages.** On a network error, timeout, or `5xx`, the app switches to demo data and shows a banner. It then checks `/health` every 30 seconds and switches back when that returns `ok`.
- **Timeouts.** `/health` 5 s, `/chat` 60 s, everything else 10 s.
- **CORS.** The browser calls the API directly, so allow the frontend's origin and the customer header:

  ```python
  from fastapi.middleware.cors import CORSMiddleware

  app.add_middleware(
      CORSMiddleware,
      allow_origins=["http://localhost:3000", "https://quickbite-support.vercel.app"],
      allow_methods=["GET", "POST"],
      allow_headers=["Content-Type", "X-Customer-Email"],
  )
  ```

---

## 1. `GET /health`

```json
{ "status": "ok", "version": "0.1.0", "model": "llama-3.1-8b-instant", "documents": 26 }
```

| Field       | Type                               | Notes                                           |
| ----------- | ---------------------------------- | ----------------------------------------------- |
| `status`    | `"ok"` \| `"degraded"` \| `"down"` | Required. `down` switches the app to demo data. |
| `version`   | string                             | Optional                                        |
| `model`     | string                             | Optional                                        |
| `documents` | integer                            | Optional. Number of indexed policy documents.   |

## 2. `POST /auth/login`

**Request**

```json
{ "email": "priya.sharma@example.com" }
```

The frontend trims and lowercases the email. Compare emails case-insensitively.

**Response**

```json
{ "customer": { "email": "priya.sharma@example.com", "name": "Priya Sharma" } }
```

| Field            | Type   | Notes                                                             |
| ---------------- | ------ | ----------------------------------------------------------------- |
| `customer.email` | string | Required. Sent back as `X-Customer-Email` on every later request. |
| `customer.name`  | string | Optional. Shown in the header and the chat greeting.              |

If no customer has that email, return `404` with `{"detail": "No account found for that email."}`. The login page shows its own message for a 404.

## 3. `POST /chat`

**Request**

```json
{
  "session_id": "conv_3f9a1c2b7d4e8a10",
  "message": "Where is my latest order?",
  "history": [
    { "role": "user", "content": "Hi" },
    { "role": "assistant", "content": "Hi! How can I help?" }
  ]
}
```

| Field        | Type   | Notes                                                                           |
| ------------ | ------ | ------------------------------------------------------------------------------- |
| `session_id` | string | One per conversation. It stays the same for every message in that conversation. |
| `message`    | string | 1–2000 characters                                                               |
| `history`    | array  | Up to 20 earlier turns, oldest first. It doesn't include `message`.             |

**Response**

```json
{
  "message_id": "msg_91c2d0a4",
  "answer": "Your order from **Dosa Republic** is on the way with Ravi and should arrive in about **11 minutes**.\n\n- Latest estimate: **7:53 PM**.\n- Promised at checkout: 7:25 PM, so it's running **28 minutes late**.",
  "sources": [
    {
      "id": "late-delivery-compensation",
      "title": "Late Delivery Compensation",
      "snippet": "Orders delivered more than 15 minutes after…"
    }
  ],
  "order": { "order_id": "QB-2026-481213", "…": "a full Order object, see below" },
  "refused": false,
  "suggestions": ["Can I get compensation for a late delivery?"]
}
```

| Field         | Type             | Notes                                                                                                             |
| ------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| `message_id`  | string           | Required. It's sent back with `/feedback`.                                                                        |
| `answer`      | string           | Required. Markdown, usually a short paragraph plus bullet points.                                                 |
| `sources`     | array            | The policies the answer used. `id` must be a policy id, because chips link to `/policies/{id}`. Defaults to `[]`. |
| `order`       | Order \| null    | Set it when the answer is about one order; the UI shows an order card.                                            |
| `refused`     | boolean          | `true` when no policy covers the question and the assistant declined. Defaults to `false`.                        |
| `suggestions` | string[] \| null | Optional follow-up questions, shown as chips under the latest answer.                                             |

A declined question looks like this:

```json
{
  "message_id": "msg_5be0",
  "answer": "I couldn't find anything in QuickBite's support policies that covers that, so I'd rather not guess.",
  "sources": [],
  "order": null,
  "refused": true
}
```

## 4. `GET /orders`

```json
{ "orders": [Order, Order, ...] }
```

Only the signed-in customer's orders, newest first.

## 5. `GET /orders/{order_id}`

Returns a single `Order`. If the id is unknown, or the order belongs to another customer, return `404` with `{"detail": "Order not found"}`.

### The Order object

```json
{
  "order_id": "QB-2026-398971",
  "status": "delivered",
  "restaurant": { "name": "Chai Point Cafe", "cuisine": "Cafe", "distance_km": 1.8 },
  "items": [
    { "name": "Blueberry Muffin", "quantity": 1, "unit_price": 140, "line_total": 140 },
    { "name": "Cappuccino", "quantity": 1, "unit_price": 160, "line_total": 160 }
  ],
  "subtotal": 300,
  "discount": { "promo_code": null, "amount": 0.0 },
  "fees": {
    "delivery_fee": 0,
    "surge_fee": 25,
    "packaging_charge": 20,
    "platform_fee": 6,
    "small_order_fee": 0
  },
  "taxes": 15.0,
  "total": 366.0,
  "payment_method": "upi",
  "timestamps": {
    "placed_at": "2026-08-12T00:30:00+05:30",
    "eta_at_checkout": "2026-08-12T01:05:00+05:30",
    "accepted_at": "2026-08-12T00:33:00+05:30",
    "final_eta": "2026-08-12T01:08:00+05:30",
    "ready_for_pickup_at": "2026-08-12T00:47:00+05:30",
    "picked_up_at": "2026-08-12T00:52:00+05:30",
    "delivered_at": "2026-08-12T01:05:00+05:30",
    "cancelled_at": null
  },
  "delay_minutes_vs_final_eta": -3,
  "driver": { "driver_id": "DRV-2402", "name": "Naveen Raj", "vehicle": "bike", "rating": 4.8 },
  "delivery": {
    "type": "handover",
    "address_label": "Home",
    "otp_required": false,
    "otp_entered": null,
    "proof_of_delivery_photo": null
  },
  "notes_to_restaurant": null,
  "substitution": null,
  "cancellation": null,
  "refund": null,
  "issues": []
}
```

- **Required fields.** Only `order_id`, `status`, `restaurant.name`, `items`, `total`, and `timestamps.placed_at` are required.
- **`status`.** Known values are `placed`, `accepted`, `preparing`, `ready_for_pickup`, `picked_up`, `out_for_delivery`, `delivered`, and `cancelled`. Any other value is still shown, as readable text.
- **Progress timeline.** It's built from `timestamps`. For an active order, "minutes away" is measured against `final_eta`. Early or late is `delivered_at` (or `final_eta`) compared with `eta_at_checkout`.
- **`cancellation`.** Read fields are `cancelled_by`, `reason`, and `cancelled_at`.
- **`refund`.** Read fields are `status`, `amount`, `method`, `initiated_at`, and `expected_by`.
- **`issues`.** Entries can be strings or objects with a `description`.
- **Driver name.** Only the driver's first name is shown.

## 6. `GET /policies`

```json
{
  "policies": [
    {
      "id": "refund-timelines",
      "title": "Refund Methods & Processing Timelines",
      "category": "refunds",
      "summary": "UPI refunds usually arrive in 2 to 4 business days…",
      "version": "v2.4",
      "effective_date": "2026-04-15"
    }
  ]
}
```

Only `id` and `title` are required. `category` drives the filter chips on the Policies page.

## 7. `GET /policies/{policy_id}`

Same fields as a policy in the list, plus `sections`:

```json
{
  "id": "refund-timelines",
  "title": "Refund Methods & Processing Timelines",
  "category": "refunds",
  "summary": "…",
  "version": "v2.4",
  "effective_date": "2026-04-15",
  "sections": [
    {
      "heading": "How long a refund takes",
      "content": "Wallet credits appear immediately. UPI refunds…"
    }
  ]
}
```

If the id is unknown, return `404`.

## 8. `POST /feedback`

```json
{ "session_id": "conv_3f9a1c2b7d4e8a10", "message_id": "msg_91c2d0a4", "rating": "up" }
```

`rating` is `"up"` or `"down"`. Respond with `204 No Content` or any 2xx JSON such as `{"ok": true}`. Feedback is best-effort, so failures are never shown to the user.
