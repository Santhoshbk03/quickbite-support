/**
 * Same-origin proxy to the QuickBite backend at BACKEND_URL.
 *
 * The FastAPI app doesn't send CORS headers, so the browser can't call it directly. The frontend
 * calls /api/backend/<route> instead, and this forwards the request server-side. Only the backend's
 * known routes are forwarded, so the proxy can't be used to reach anything else.
 */

const ROUTES: Readonly<Record<string, "GET" | "POST">> = {
  "openapi.json": "GET",
  chat: "POST",
  userdetails: "POST",
  user_orders_id: "POST",
  user_order_detail: "POST",
};

/** Longer than the browser's own chat timeout, so the browser reports the timeout. */
const TIMEOUT_MS = 100_000;

async function forward(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const backendUrl = process.env.BACKEND_URL?.trim().replace(/\/+$/, "");
  if (!backendUrl) {
    return Response.json({ detail: "BACKEND_URL is not set." }, { status: 503 });
  }

  const route = (await params).path.join("/");
  if (ROUTES[route] !== request.method) {
    return Response.json({ detail: "Not found" }, { status: 404 });
  }

  const { search } = new URL(request.url);
  try {
    const upstream = await fetch(`${backendUrl}/${route}${search}`, {
      method: request.method,
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: request.method === "POST" ? await request.text() : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return Response.json(
      {
        detail: timedOut ? "The backend took too long to respond." : "Couldn't reach the backend.",
      },
      { status: timedOut ? 504 : 502 },
    );
  }
}

export const GET = forward;
export const POST = forward;
