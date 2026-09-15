# QuickBite Support API

The frontend needs **7 JSON endpoints**. Until they exist it runs on built-in demo data. To connect a backend:

```bash
NEXT_PUBLIC_API_MODE=live
NEXT_PUBLIC_API_URL=http://localhost:8000
```

| #   | Method | Path                    | Used by                               |
| --- | ------ | ----------------------- | ------------------------------------- |
| 1   | GET    | `/health`               | Status badge in the header            |
| 2   | POST   | `/chat`                 | Chat                                  |
| 3   | GET    | `/orders`               | Orders page                           |
| 4   | GET    | `/orders/{order_id}`    | Order detail page                     |
| 5   | GET    | `/policies`             | Policies page                         |
| 6   | GET    | `/policies/{policy_id}` | Policy page, and source links in chat |
| 7   | POST   | `/feedback`             | Thumbs up / down on an answer         |

The source of truth is [`src/lib/api/types.ts`](../src/lib/api/types.ts): every response is validated against those Zod schemas. The live client is [`http.ts`](../src/lib/api/http.ts), and the demo data is [`mock.ts`](../src/lib/api/mock.ts).

## Conventions

- **Format.** JSON with snake_case field names.
- **Timestamps.** ISO 8601, preferably with an offset: `2026-08-12T00:30:00+05:30`.
- **Money.** Amounts are numbers in major units (rupees): `366.0`. `currency` defaults to `INR`.
- **Optional fields.** They can be `null` or left out.
- **Unknown fields.** Extra fields are ignored and dropped. Customer identifiers such as `customer_email` and `customer_id` never reach the UI, but it's better not to send them at all.
- **Errors.** Return a non-2xx status with FastAPI's usual body, `{"detail": "Order not found"}`. A string `detail` is shown to the user.
- **404.** Unknown order and policy ids should return `404`. The UI shows a "not found" state.
- **Outages.** On a network error, timeout, or `5xx`, the app switches to demo data and shows a banner. It then checks `/health` every 30 seconds and switches back when that returns `ok`.
- **Timeouts.** `/health` 5 s, `/chat` 60 s, everything else 10 s.
- **CORS.** The browser calls the API directly, so allow the frontend's origin:

  ```python
  from fastapi.middleware.cors import CORSMiddleware

  app.add_middleware(
      CORSMiddleware,
      allow_origins=["http://localhost:3000", "https://quickbite-support.vercel.app"],
      allow_methods=["GET", "POST"],
      allow_headers=["Content-Type"],
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

## 2. `POST /chat`

**Request**

```json
{
  "session_id": "conv_3f9a1c2b7d4e8a10",
  "message": "Where is my order QB-2026-481213?",
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

## 3. `GET /orders`

```json
{ "orders": [Order, Order, ...] }
```

Newest first.

## 4. `GET /orders/{order_id}`

Returns a single `Order`. If the id is unknown, return `404` with `{"detail": "Order not found"}`.

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

## 5. `GET /policies`

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

## 6. `GET /policies/{policy_id}`

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

## 7. `POST /feedback`

```json
{ "session_id": "conv_3f9a1c2b7d4e8a10", "message_id": "msg_91c2d0a4", "rating": "up" }
```

`rating` is `"up"` or `"down"`. Respond with `204 No Content` or any 2xx JSON such as `{"ok": true}`. Feedback is best-effort, so failures are never shown to the user.
