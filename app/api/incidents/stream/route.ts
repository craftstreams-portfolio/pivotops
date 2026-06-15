import { getEventTrace } from "@/lib/events/event.trace";

// ===============================
// INCIDENT STREAM (SSE)
// ===============================
export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const interval = setInterval(async () => {
        const traces = await getEventTrace(20);

        const payload = JSON.stringify({
          type: "incident_update",
          data: traces,
          timestamp: Date.now(),
        });

        controller.enqueue(
          encoder.encode(`data: ${payload}\n\n`)
        );
      }, 3000);

      return () => clearInterval(interval);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}