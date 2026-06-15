import { replayStreamHandler } from "@/lib/replay/replay.sse";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get("eventId");

  if (!eventId) {
    return new Response("Missing eventId", { status: 400 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      (async () => {
        try {
          for await (const step of require("@/lib/replay/replay.stream").streamReplay(eventId)) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "REPLAY_STEP",
                  payload: step,
                })}\n\n`
              )
            );
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "REPLAY_DONE",
                eventId,
              })}\n\n`
            )
          );

          controller.close();
        } catch (err) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "REPLAY_ERROR",
                error: "stream failed",
              })}\n\n`
            )
          );

          controller.close();
        }
      })();
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