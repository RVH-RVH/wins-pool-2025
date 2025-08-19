import { NextResponse } from "next/server";
import { onLeagueUpdate } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const leagueId = params.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Initial event so clients know they're connected
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "hello" })}\n\n`));

      const unsubscribe = onLeagueUpdate(leagueId, (payload) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {}
      });

      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(":keep-alive\n\n"));
        } catch {}
      }, 25000);

      // Teardown
      const cancel = () => {
        try { unsubscribe(); } catch {}
        clearInterval(keepAlive);
        try { controller.close(); } catch {}
      };

      // If the client disconnects, close
      // @ts-ignore
      req.signal?.addEventListener("abort", cancel);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
