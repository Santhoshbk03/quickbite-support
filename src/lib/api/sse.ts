/**
 * Server-sent events decoder (WHATWG framing, minus reconnection).
 *
 * `EventSource` can't POST, so /chat is consumed with fetch + a manual parser. That makes the
 * framing rules in API_CONTRACT.md §1.4 our responsibility, so this handles the awkward parts:
 * chunk boundaries mid-line, `\r\n`, comments (heartbeats), and multi-line `data:`.
 */
export interface SseFrame {
  /** `event:` line, or null when the server omitted it. */
  event: string | null;
  /** `id:` line, or null. */
  id: string | null;
  /** Concatenated `data:` lines, joined with "\n". */
  data: string;
}

export async function* decodeSseStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<SseFrame, void, void> {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");

  let buffer = "";
  let atStart = true;
  let eventName: string | null = null;
  let lastId: string | null = null;
  let dataLines: string[] = [];
  let hasFields = false;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      if (atStart) {
        if (buffer.startsWith("﻿")) buffer = buffer.slice(1);
        atStart = false;
      }

      let newline = buffer.indexOf("\n");
      while (newline !== -1) {
        let line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);

        if (line === "") {
          // Blank line dispatches the event. Field-less blocks (bare heartbeats) are skipped.
          if (hasFields) {
            yield { event: eventName, id: lastId, data: dataLines.join("\n") };
          }
          eventName = null;
          dataLines = [];
          hasFields = false;
        } else if (!line.startsWith(":")) {
          const colon = line.indexOf(":");
          const field = colon === -1 ? line : line.slice(0, colon);
          let fieldValue = colon === -1 ? "" : line.slice(colon + 1);
          if (fieldValue.startsWith(" ")) fieldValue = fieldValue.slice(1);

          if (field === "event") {
            eventName = fieldValue;
            hasFields = true;
          } else if (field === "data") {
            dataLines.push(fieldValue);
            hasFields = true;
          } else if (field === "id") {
            lastId = fieldValue;
            hasFields = true;
          }
          // `retry` and unknown fields are ignored, per spec.
        }

        newline = buffer.indexOf("\n");
      }
    }
    // A trailing block with no terminating blank line is discarded, per spec. The caller reports it
    // as `stream_interrupted` because no terminal event arrived.
  } finally {
    // Cancel rather than releaseLock: an early `return` from the consumer (terminal event, abort)
    // must also close the underlying HTTP body.
    try {
      await reader.cancel();
    } catch {
      // Already errored or closed.
    }
  }
}
