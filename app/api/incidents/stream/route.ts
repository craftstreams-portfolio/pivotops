import { NextRequest } from "next/server";
import { validateSession } from "@/lib/security/apiAuth";
import { getEventTrace } from "@/lib/events/event.trace";

export async function GET(req: NextRequest) {
  const auth = await validateSession(req);
  if (!auth) {
    return new Response(JSON.stringify({ error: "Authentication required." }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const interval = setInterval(async () => {
        const traces = await getEventTrace(20);
        const payload = JSON.stringify({ type: "incident_update", data: traces, timestamp: Date.now() });
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      }, 3000);
      return () => clearInterval(interval);
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}