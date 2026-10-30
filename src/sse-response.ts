import type { Envelope, Row } from "./data/types";

/** What one event carries: rows to append, or an envelope (`{ op: "replace", rows }`). */
export type SseMessage = Row[] | Row | Envelope;

export interface SseResponseOptions {
  /** Abort with the request: the stream ends when the client goes away. */
  signal?: AbortSignal;
  /** A comment line every this many ms keeps proxies from closing an idle stream. Default 15000. */
  heartbeatMs?: number;
  headers?: HeadersInit;
}

/**
 * A `text/event-stream` Response for `sseSource`, from any async iterable of messages. It uses only
 * the Web Response API, so it works in Next.js route handlers and any fetch-style server.
 *
 *   export async function GET(request: Request) {
 *     return sseResponse(liveRows(), { signal: request.signal });
 *   }
 */
export function sseResponse(messages: AsyncIterable<SseMessage>, opts: SseResponseOptions = {}): Response {
  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let iterator: AsyncIterator<SseMessage> | undefined;
  const stop = () => {
    if (heartbeat) clearInterval(heartbeat);
    void iterator?.return?.();
  };
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (text: string) => {
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          stop();
        }
      };
      heartbeat = setInterval(() => send(": keep-alive\n\n"), opts.heartbeatMs ?? 15_000);
      opts.signal?.addEventListener("abort", () => {
        stop();
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      });
      iterator = messages[Symbol.asyncIterator]();
      try {
        for (;;) {
          const next = await iterator.next();
          if (next.done || opts.signal?.aborted) break;
          // One `data:` line: JSON has no raw newlines.
          send(`data: ${JSON.stringify(next.value)}\n\n`);
        }
        stop();
        controller.close();
      } catch (err) {
        stop();
        controller.error(err);
      }
    },
    cancel: stop,
  });
  return new Response(body, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      ...Object.fromEntries(new Headers(opts.headers)),
    },
  });
}
